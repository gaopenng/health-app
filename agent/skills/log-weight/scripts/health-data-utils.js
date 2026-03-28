const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function listJsonFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const out = [];
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.json')) out.push(fullPath);
    }
  }
  return out.sort();
}

function sortByDateTime(a, b) {
  const left = `${a.date || ''}T${a.time || '00:00'}`;
  const right = `${b.date || ''}T${b.time || '00:00'}`;
  return left.localeCompare(right);
}

function inferDateFromPath(filePath) {
  const base = path.basename(filePath, '.json');
  return /^\d{4}-\d{2}-\d{2}$/.test(base) ? base : '';
}

function buildDailyFilePath(baseDir, category, date) {
  const [year, month] = date.split('-');
  return path.join(baseDir, category, year, `${year}-${month}`, `${date}.json`);
}

function readDailyRecords(userDir, category, cutoffDate = '') {
  return listJsonFilesRecursive(path.join(userDir, category))
    .map(filePath => {
      const raw = readJson(filePath);
      if (raw == null) return null;
      const date = raw.date || inferDateFromPath(filePath);
      if (!date) return null;
      if (cutoffDate && date < cutoffDate) return null;
      return { date, path: filePath, ...raw };
    })
    .filter(Boolean)
    .sort(sortByDateTime);
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || '').trim());
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

module.exports = {
  buildDailyFilePath,
  isValidDate,
  isValidTime,
  listJsonFilesRecursive,
  readDailyRecords,
  readJson,
  sortByDateTime,
  toNumber,
  writeJson,
};
