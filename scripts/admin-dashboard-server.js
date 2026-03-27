#!/usr/bin/env node
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const repoRoot = path.resolve(__dirname, '..');
const dashboardRoot = path.join(repoRoot, 'dashboard');
const healthRoot = process.env.HEALTH_DATA_DIR || path.join(os.homedir(), '.health');
const port = Number.parseInt(process.env.PORT || process.argv[2] || '4180', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': MIME_TYPES['.json'],
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function serveStatic(res, targetPath) {
  if (!targetPath.startsWith(dashboardRoot)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  let stat;
  try {
    stat = fs.statSync(targetPath);
  } catch {
    sendText(res, 404, 'Not Found');
    return;
  }

  const finalPath = stat.isDirectory() ? path.join(targetPath, 'index.html') : targetPath;
  try {
    const data = fs.readFileSync(finalPath);
    const ext = path.extname(finalPath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': ext === '.html' ? 'no-store' : 'no-cache',
    });
    res.end(data);
  } catch {
    sendText(res, 404, 'Not Found');
  }
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(dirPath, name))
    .sort();
}

function cutoffDate(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days + 1);
  return d.toISOString().slice(0, 10);
}

function sortByDateTimeAsc(a, b) {
  const left = `${a.date || ''}T${a.time || '00:00'}`;
  const right = `${b.date || ''}T${b.time || '00:00'}`;
  return left.localeCompare(right);
}

function sortByDateTimeDesc(a, b) {
  return sortByDateTimeAsc(b, a);
}

function readRecordFiles(baseDir, subdir, days) {
  const minDate = cutoffDate(days);
  return listJsonFiles(path.join(baseDir, subdir))
    .map(filePath => ({
      file: path.basename(filePath),
      path: filePath,
      raw: readJson(filePath),
    }))
    .filter(entry => entry.raw && entry.raw.date)
    .filter(entry => entry.raw.date >= minDate);
}

function getUsers() {
  const usersData = readJson(path.join(healthRoot, 'users.json'), { users: [] });
  const users = Array.isArray(usersData?.users) ? usersData.users : [];
  return users
    .filter(user => user.status === 'active')
    .map(user => ({
      sender_id: user.sender_id,
      name: user.name,
      role: user.role,
      dashboard_token: user.dashboard_token,
      last_active_at: user.last_active_at,
      daily_report_target: user.daily_report_target,
    }));
}

function buildRawPayload(senderId, days) {
  const users = getUsers();
  const user = users.find(item => item.sender_id === senderId);
  if (!user) return null;

  const userDir = path.join(healthRoot, senderId);
  const profile = readJson(path.join(userDir, 'profile.json'), {});
  const weights = readRecordFiles(userDir, 'weight', days)
    .map(entry => ({ file: entry.file, ...entry.raw }))
    .sort(sortByDateTimeAsc);
  const diets = readRecordFiles(userDir, 'diet', days)
    .map(entry => ({ file: entry.file, ...entry.raw }))
    .sort(sortByDateTimeDesc);
  const workouts = readRecordFiles(userDir, 'workout', days)
    .map(entry => ({ file: entry.file, ...entry.raw }))
    .sort(sortByDateTimeDesc);

  const latestWeight = weights.length ? weights[weights.length - 1] : null;
  const today = new Date().toISOString().slice(0, 10);
  const todayDiet = diets.find(item => item.date === today) || null;
  const workoutsLast7 = workouts.filter(item => item.date >= cutoffDate(7));

  return {
    generated_at: new Date().toISOString(),
    source: 'raw-files',
    days,
    user,
    profile,
    quick_stats: {
      latest_weight_kg: latestWeight?.weight_kg ?? null,
      latest_weight_time: latestWeight ? `${latestWeight.date} ${latestWeight.time || ''}`.trim() : null,
      today_calories: todayDiet?.total_calories ?? 0,
      today_protein_g: todayDiet?.total_protein_g ?? 0,
      workout_days_last_7d: workoutsLast7.length,
      latest_diet_date: todayDiet?.date || (diets[0]?.date ?? null),
    },
    weights,
    diets,
    workouts,
  };
}

function handleApi(req, res, url) {
  if (url.pathname === '/api/admin/users') {
    sendJson(res, 200, { users: getUsers(), generated_at: new Date().toISOString() });
    return true;
  }

  if (url.pathname === '/api/admin/raw') {
    const senderId = url.searchParams.get('sender_id');
    const days = Number.parseInt(url.searchParams.get('days') || '30', 10);
    if (!senderId) {
      sendJson(res, 400, { error: 'sender_id is required' });
      return true;
    }
    const payload = buildRawPayload(senderId, days);
    if (!payload) {
      sendJson(res, 404, { error: 'user not found' });
      return true;
    }
    sendJson(res, 200, payload);
    return true;
  }

  if (url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true, health_root: healthRoot, now: new Date().toISOString() });
    return true;
  }

  return false;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || `127.0.0.1:${port}`}`);
  if (handleApi(req, res, url)) return;

  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '/') pathname = '/admin/';
  const targetPath = path.join(dashboardRoot, pathname);
  serveStatic(res, targetPath);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Admin dashboard server running at http://127.0.0.1:${port}/admin/`);
  console.log(`Health data root: ${healthRoot}`);
});
