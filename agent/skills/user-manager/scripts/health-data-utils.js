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

function normalizeChannel(value) {
  if (!value) return 'unknown';
  return String(value).trim().toLowerCase() || 'unknown';
}

function getUserId(user) {
  return String(user?.user_id || '').trim();
}

function getUserIdentities(user) {
  return Array.isArray(user?.identities)
    ? user.identities
        .filter(identity => identity && identity.sender_id)
        .map(identity => ({
          channel: normalizeChannel(identity.channel),
          sender_id: String(identity.sender_id),
        }))
    : [];
}

function getPrimaryIdentity(user) {
  return getUserIdentities(user)[0] || null;
}

function normalizeUserRecord(user) {
  const userId = getUserId(user);
  const identities = getUserIdentities(user);
  const primaryIdentity = identities[0] || null;
  return {
    ...user,
    user_id: userId,
    sender_id: primaryIdentity?.sender_id || '',
    channel: normalizeChannel(primaryIdentity?.channel),
    identities,
  };
}

function readUsers(healthRoot) {
  const usersData = readJson(path.join(healthRoot, 'users.json'), { users: [] });
  const users = Array.isArray(usersData?.users) ? usersData.users : [];
  return users.map(normalizeUserRecord);
}

function getUserDataDir(healthRoot, user) {
  return path.join(healthRoot, getUserId(user));
}

function identityMatches(identity, senderId, channel) {
  if (!identity || !senderId) return false;
  if (String(identity.sender_id) !== String(senderId)) return false;
  if (!channel) return true;

  const expectedChannel = normalizeChannel(channel);
  const actualChannel = normalizeChannel(identity.channel);
  return actualChannel === 'unknown' || actualChannel === expectedChannel;
}

function resolveUser(users, { userId = '', senderId = '', channel = '' } = {}) {
  if (userId) {
    return users.find(user => getUserId(user) === String(userId)) || null;
  }

  if (!senderId) return null;

  return users.find(user =>
    getUserIdentities(user).some(identity => identityMatches(identity, senderId, channel))
  ) || null;
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

function normalizeMealType(value) {
  const raw = String(value || '').trim().toLowerCase();
  const map = {
    breakfast: 'breakfast',
    lunch: 'lunch',
    dinner: 'dinner',
    snack: 'snack',
    早餐: 'breakfast',
    午餐: 'lunch',
    晚餐: 'dinner',
    加餐: 'snack',
  };
  return map[raw] || raw || 'snack';
}

function isSupportedMealType(value) {
  return ['breakfast', 'lunch', 'dinner', 'snack'].includes(value);
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeDietItem(item = {}) {
  return {
    name: item?.name || '',
    amount: item?.amount || item?.quantity || '',
    calories_est: toNumber(item?.calories_est),
    protein_est_g: toNumber(item?.protein_est_g),
    carb_est_g: toNumber(item?.carb_est_g),
    fat_est_g: toNumber(item?.fat_est_g),
  };
}

function computeDietDescription(items = [], fallback = '') {
  const names = items
    .map(item => item?.name || '')
    .filter(Boolean);

  if (names.length) {
    return [...new Set(names)].join(' + ');
  }

  return fallback || '未填写描述';
}

function computeDietMealTotals(items = []) {
  return {
    meal_calories: items.reduce((sum, item) => sum + toNumber(item?.calories_est), 0),
    meal_protein_g: items.reduce((sum, item) => sum + toNumber(item?.protein_est_g), 0),
    meal_carb_g: items.reduce((sum, item) => sum + toNumber(item?.carb_est_g), 0),
    meal_fat_g: items.reduce((sum, item) => sum + toNumber(item?.fat_est_g), 0),
  };
}

function computeDietDailyTotals(meals = []) {
  return {
    total_calories: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_calories), 0),
    total_protein_g: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_protein_g), 0),
    total_carb_g: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_carb_g), 0),
    total_fat_g: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_fat_g), 0),
  };
}

function normalizeDietDailyRecord(raw, date = '') {
  if (!raw || Array.isArray(raw) || typeof raw !== 'object') return null;

  const meals = Array.isArray(raw.meals)
    ? raw.meals.map((meal, index) => {
        const mealType = normalizeMealType(meal?.meal_type || meal?.meal);
        const items = Array.isArray(meal?.items) ? meal.items.map(normalizeDietItem) : [];
        const source = String(meal?.source || '').trim();
        return {
          id: meal?.id || `meal_${index + 1}`,
          meal_type: mealType,
          time: String(meal?.time || '').trim().slice(0, 5),
          description: String(meal?.description || computeDietDescription(items, mealType)).trim(),
          source: ['text', 'image', 'mixed'].includes(source) ? source : 'text',
          items,
          ...computeDietMealTotals(items),
          channel: meal?.channel || '',
          sender_id: meal?.sender_id || '',
          sender_name: meal?.sender_name || '',
        };
      })
    : [];

  return {
    date: raw.date || date,
    meals,
    ...computeDietDailyTotals(meals),
  };
}

function createEmptyDietDailyRecord(date) {
  return {
    date,
    meals: [],
    total_calories: 0,
    total_protein_g: 0,
    total_carb_g: 0,
    total_fat_g: 0,
  };
}

function readDietDailyRecord(dataDir, date) {
  const filePath = buildDailyFilePath(dataDir, 'diet', date);
  const raw = readJson(filePath);
  return {
    filePath,
    data: normalizeDietDailyRecord(raw, date) || createEmptyDietDailyRecord(date),
  };
}

function readDailyRecords(userDir, category, cutoffDate = '') {
  return listJsonFilesRecursive(path.join(userDir, category))
    .map(filePath => {
      const raw = readJson(filePath);
      if (raw == null) return null;
      const inferredDate = inferDateFromPath(filePath);
      const normalized =
        category === 'diet'
          ? normalizeDietDailyRecord(raw, inferredDate)
          : raw;
      const date = normalized?.date || inferredDate;
      if (!normalized || !date) return null;
      if (cutoffDate && date < cutoffDate) return null;
      return {
        file: path.relative(path.join(userDir, category), filePath),
        path: filePath,
        date,
        ...normalized,
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
  createEmptyDietDailyRecord,
  getPrimaryIdentity,
  getUserDataDir,
  getUserId,
  getUserIdentities,
  isSupportedMealType,
  normalizeChannel,
  normalizeDietDailyRecord,
  normalizeMealType,
  normalizeUserRecord,
  listJsonFilesRecursive,
  readDietDailyRecord,
  readDailyRecords,
  readJson,
  readUsers,
  resolveUser,
  sortByDateTime,
  toNumber,
  writeJson,
};
