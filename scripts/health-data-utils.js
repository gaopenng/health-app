const fs = require('fs');
const path = require('path');

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
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
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.json')) {
        out.push(fullPath);
      }
    }
  }

  return out.sort();
}

function sortByDateTime(a, b) {
  const left = `${a.date || ''}T${a.time || '00:00'}`;
  const right = `${b.date || ''}T${b.time || '00:00'}`;
  return left.localeCompare(right);
}

function readDailyRecords(userDir, category, cutoffDate = '') {
  return listJsonFilesRecursive(path.join(userDir, category))
    .map(filePath => {
      const raw = readJson(filePath);
      if (!raw || !raw.date) return null;
      if (cutoffDate && raw.date < cutoffDate) return null;
      return {
        file: path.relative(path.join(userDir, category), filePath),
        path: filePath,
        ...raw,
      };
    })
    .filter(Boolean)
    .sort(sortByDateTime);
}

function buildDailyFilePath(baseDir, category, date) {
  const [year, month] = date.split('-');
  return path.join(baseDir, category, year, `${year}-${month}`, `${date}.json`);
}

module.exports = {
  buildDailyFilePath,
  listJsonFilesRecursive,
  readDailyRecords,
  readJson,
  sortByDateTime,
};
