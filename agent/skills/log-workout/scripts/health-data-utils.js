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

function buildDailyFilePath(baseDir, category, date) {
  const [year, month] = date.split('-');
  return path.join(baseDir, category, year, `${year}-${month}`, `${date}.json`);
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

function readWorkoutDailyRecord(dataDir, date) {
  const filePath = buildDailyFilePath(dataDir, 'workout', date);
  const raw = readJson(filePath, null);
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.exercises)) {
    return { filePath, data: { date, exercises: [] } };
  }
  return { filePath, data: { date: raw.date || date, exercises: raw.exercises } };
}

module.exports = {
  buildDailyFilePath,
  isValidDate,
  isValidTime,
  readJson,
  readWorkoutDailyRecord,
  toNumber,
  writeJson,
};
