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

function normalizeChannel(value) {
  if (!value) return 'unknown';
  return String(value).trim().toLowerCase() || 'unknown';
}

function getUserId(user) {
  return user?.user_id || user?.sender_id || '';
}

function getUserIdentities(user) {
  const identities = Array.isArray(user?.identities)
    ? user.identities
        .filter(identity => identity && identity.sender_id)
        .map(identity => ({
          channel: normalizeChannel(identity.channel),
          sender_id: String(identity.sender_id),
        }))
    : [];

  if (identities.length) return identities;
  if (!user?.sender_id) return [];

  return [{
    channel: normalizeChannel(user.channel),
    sender_id: String(user.sender_id),
  }];
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
    sender_id: user?.sender_id || primaryIdentity?.sender_id || '',
    channel: normalizeChannel(user?.channel || primaryIdentity?.channel),
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

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function normalizeLegacyDietArray(raw, date) {
  if (!Array.isArray(raw)) return null;

  const meals = raw.map((entry, index) => {
    const nutrition = entry?.estimated_nutrition || {};
    const recordedAt = String(entry?.recorded_at || '').trim();
    const time = recordedAt.slice(11, 16) || '';
    const items = Array.isArray(entry?.items)
      ? entry.items.map(item => ({
          name: item?.name || '',
          amount: item?.quantity || item?.amount || '',
          calories_est: toNumber(item?.calories_est),
          protein_est_g: toNumber(item?.protein_est_g),
          carb_est_g: toNumber(item?.carb_est_g),
          fat_est_g: toNumber(item?.fat_est_g),
        }))
      : [];

    return {
      id: `legacy_${index + 1}`,
      meal_type: normalizeMealType(entry?.meal),
      time,
      description: entry?.text || items.map(item => item.name).filter(Boolean).join(' + ') || entry?.meal || '未填写描述',
      source: entry?.source || 'text',
      items,
      meal_calories: toNumber(nutrition?.calories_kcal),
      meal_protein_g: toNumber(nutrition?.protein_g),
      meal_carb_g: toNumber(nutrition?.carbs_g),
      meal_fat_g: toNumber(nutrition?.fat_g),
      recorded_at: recordedAt,
      channel: entry?.channel || '',
      sender_id: entry?.sender_id || '',
      sender_name: entry?.sender_name || '',
      raw_text: entry?.text || '',
    };
  });

  return {
    date,
    meals,
    total_calories: meals.reduce((sum, meal) => sum + toNumber(meal.meal_calories), 0),
    total_protein_g: meals.reduce((sum, meal) => sum + toNumber(meal.meal_protein_g), 0),
    total_carb_g: meals.reduce((sum, meal) => sum + toNumber(meal.meal_carb_g), 0),
    total_fat_g: meals.reduce((sum, meal) => sum + toNumber(meal.meal_fat_g), 0),
    legacy_format: true,
  };
}

function readDailyRecords(userDir, category, cutoffDate = '') {
  return listJsonFilesRecursive(path.join(userDir, category))
    .map(filePath => {
      const raw = readJson(filePath);
      if (raw == null) return null;
      const inferredDate = inferDateFromPath(filePath);
      const normalized =
        category === 'diet' && Array.isArray(raw)
          ? normalizeLegacyDietArray(raw, inferredDate)
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
  getPrimaryIdentity,
  getUserDataDir,
  getUserId,
  getUserIdentities,
  normalizeChannel,
  normalizeUserRecord,
  listJsonFilesRecursive,
  readDailyRecords,
  readJson,
  readUsers,
  resolveUser,
  sortByDateTime,
};
