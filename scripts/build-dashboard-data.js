#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

const repoRoot = path.resolve(__dirname, '..');
const defaultHealthDir = path.join(os.homedir(), '.health');
const defaultOutputDir = path.join(repoRoot, 'dashboard', 'data');
const args = process.argv.slice(2);

function getArg(name, fallback = null) {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function hasArg(name) {
  return args.includes(name);
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function listJsonFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  return fs.readdirSync(dirPath)
    .filter(name => name.endsWith('.json'))
    .map(name => path.join(dirPath, name))
    .sort();
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateDaysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

function lastNDates(days) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) out.push(formatDate(dateDaysAgo(i)));
  return out;
}

function sortByDateTime(a, b) {
  const left = `${a.date || ''}T${a.time || '00:00'}`;
  const right = `${b.date || ''}T${b.time || '00:00'}`;
  return left.localeCompare(right);
}

function readWeightHistory(userDir, cutoffDate) {
  const files = listJsonFiles(path.join(userDir, 'weight'));
  return files
    .map(file => readJson(file))
    .filter(Boolean)
    .filter(entry => entry.date && entry.date >= cutoffDate)
    .sort(sortByDateTime)
    .map(entry => ({ date: entry.date, weight_kg: entry.weight_kg }));
}

function readDietMap(userDir) {
  const files = listJsonFiles(path.join(userDir, 'diet'));
  const map = new Map();
  for (const file of files) {
    const entry = readJson(file);
    if (!entry || !entry.date) continue;
    map.set(entry.date, entry);
  }
  return map;
}

function readWorkoutMap(userDir) {
  const files = listJsonFiles(path.join(userDir, 'workout'));
  const map = new Map();
  for (const file of files) {
    const entry = readJson(file);
    if (!entry || !entry.date) continue;
    map.set(entry.date, entry);
  }
  return map;
}

function aggregateUser(user, healthDataDir, days) {
  const userDir = path.join(healthDataDir, user.sender_id);
  const profile = readJson(path.join(userDir, 'profile.json'), {}) || {};
  const cutoffDate = formatDate(dateDaysAgo(days - 1));
  const weightHistory = readWeightHistory(userDir, cutoffDate);
  const dietMap = readDietMap(userDir);
  const workoutMap = readWorkoutMap(userDir);
  const dailyStats = lastNDates(days).map(date => {
    const diet = dietMap.get(date);
    const workout = workoutMap.get(date);
    const exercises = Array.isArray(workout?.exercises) ? workout.exercises : [];
    return {
      date,
      calories: diet?.total_calories || 0,
      protein_g: diet?.total_protein_g || 0,
      carb_g: diet?.total_carb_g || 0,
      fat_g: diet?.total_fat_g || 0,
      workout_count: exercises.length,
      trained: exercises.length > 0,
    };
  });

  const recentWorkouts = [...workoutMap.values()]
    .filter(entry => entry.date && entry.date >= cutoffDate)
    .sort(sortByDateTime)
    .filter(entry => Array.isArray(entry.exercises) && entry.exercises.length)
    .slice(-7)
    .map(entry => ({
      date: entry.date,
      exercises: entry.exercises.map(ex => ex && ex.name).filter(Boolean),
    }));

  return {
    generated_at: new Date().toISOString(),
    profile: {
      daily_calorie_target: profile.daily_calorie_target || 2000,
      protein_target_g: profile.protein_target_g || 120,
      carb_target_g: profile.carb_target_g || 250,
      fat_target_g: profile.fat_target_g || 65,
      weekly_workout_target: profile.weekly_workout_target || 3,
    },
    weight_history: weightHistory,
    daily_stats: dailyStats,
    recent_workouts: recentWorkouts,
  };
}

function main() {
  const healthDataDir = path.resolve(getArg('--health-data-dir', defaultHealthDir));
  const outputDir = path.resolve(getArg('--output-dir', defaultOutputDir));
  const days = Number.parseInt(getArg('--days', '30'), 10);
  const senderIdFilter = getArg('--sender-id');
  const usersFile = path.join(healthDataDir, 'users.json');
  const usersData = readJson(usersFile, { users: [] });
  const users = Array.isArray(usersData.users) ? usersData.users : [];
  const activeUsers = users.filter(user => user.status === 'active' && user.dashboard_token);
  const targetUsers = senderIdFilter
    ? activeUsers.filter(user => user.sender_id === senderIdFilter)
    : activeUsers;

  if (!targetUsers.length) {
    console.error('No active users with dashboard_token found.');
    process.exit(1);
  }

  ensureDir(outputDir);

  for (const user of targetUsers) {
    const payload = aggregateUser(user, healthDataDir, days);
    const outFile = path.join(outputDir, `${user.dashboard_token}.json`);
    fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`wrote ${outFile}`);
    console.log(`preview http://127.0.0.1:4173/?token=${user.dashboard_token}`);
  }
}

if (hasArg('--help')) {
  console.log('Usage: node scripts/build-dashboard-data.js [--health-data-dir DIR] [--output-dir DIR] [--days 30] [--sender-id ID]');
  process.exit(0);
}

main();
