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

function normalizeSnackPeriod(value) {
  const raw = String(value || '').trim().toLowerCase();
  const map = {
    morning: 'morning',
    afternoon: 'afternoon',
    evening: 'evening',
    上午: 'morning',
    下午: 'afternoon',
    晚上: 'evening',
    夜间: 'evening',
  };
  return map[raw] || '';
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function makeDietMealId() {
  return `meal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferSnackPeriodFromTime(time = '') {
  const normalized = String(time || '').trim().slice(0, 5);
  if (!/^\d{2}:\d{2}$/.test(normalized)) return 'afternoon';
  if (normalized < '11:00') return 'morning';
  if (normalized < '18:00') return 'afternoon';
  return 'evening';
}

function buildMealSlotKey(mealType, snackPeriod = '') {
  const normalizedMealType = normalizeMealType(mealType);
  if (normalizedMealType !== 'snack') return normalizedMealType;
  const normalizedSnackPeriod = normalizeSnackPeriod(snackPeriod) || 'afternoon';
  return `snack:${normalizedSnackPeriod}`;
}

function inferTimeFromRecordedAt(recordedAt = '') {
  const value = String(recordedAt || '').trim();
  return value.slice(11, 16) || '';
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

function normalizeLegacyDietArray(raw, date) {
  if (!Array.isArray(raw)) return null;

  const meals = raw.map((entry, index) => {
    const nutrition = entry?.estimated_nutrition || {};
    const recordedAt = String(entry?.recorded_at || '').trim();
    const time = inferTimeFromRecordedAt(recordedAt);
    const items = Array.isArray(entry?.items)
      ? entry.items.map(normalizeDietItem)
      : [];
    const mealType = normalizeMealType(entry?.meal);
    const snackPeriod = mealType === 'snack' ? inferSnackPeriodFromTime(time) : '';

    return {
      id: `legacy_${index + 1}`,
      meal_type: mealType,
      snack_period: snackPeriod,
      slot_key: buildMealSlotKey(mealType, snackPeriod),
      time,
      description: entry?.text || computeDietDescription(items, entry?.meal),
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

function normalizeDietDailyRecord(raw, date = '') {
  if (Array.isArray(raw)) return normalizeLegacyDietArray(raw, date);
  if (!raw || typeof raw !== 'object') return null;

  const meals = Array.isArray(raw.meals)
    ? raw.meals.map((meal, index) => {
        const mealType = normalizeMealType(meal?.meal_type || meal?.meal);
        const snackPeriod = mealType === 'snack'
          ? normalizeSnackPeriod(meal?.snack_period) || inferSnackPeriodFromTime(meal?.time || inferTimeFromRecordedAt(meal?.recorded_at))
          : '';
        const items = Array.isArray(meal?.items) ? meal.items.map(normalizeDietItem) : [];
        return {
          ...meal,
          id: meal?.id || `meal_${index + 1}`,
          meal_type: mealType,
          snack_period: snackPeriod,
          slot_key: meal?.slot_key || buildMealSlotKey(mealType, snackPeriod),
          time: meal?.time || inferTimeFromRecordedAt(meal?.recorded_at),
          description: meal?.description || computeDietDescription(items, meal?.meal_type),
          items,
          meal_calories: toNumber(meal?.meal_calories),
          meal_protein_g: toNumber(meal?.meal_protein_g),
          meal_carb_g: toNumber(meal?.meal_carb_g),
          meal_fat_g: toNumber(meal?.meal_fat_g),
        };
      })
    : [];

  return {
    ...raw,
    date: raw.date || date,
    meals,
    total_calories: toNumber(raw.total_calories || meals.reduce((sum, meal) => sum + toNumber(meal.meal_calories), 0)),
    total_protein_g: toNumber(raw.total_protein_g || meals.reduce((sum, meal) => sum + toNumber(meal.meal_protein_g), 0)),
    total_carb_g: toNumber(raw.total_carb_g || meals.reduce((sum, meal) => sum + toNumber(meal.meal_carb_g), 0)),
    total_fat_g: toNumber(raw.total_fat_g || meals.reduce((sum, meal) => sum + toNumber(meal.meal_fat_g), 0)),
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

function appendDietEntry(dataDir, entry) {
  const date = String(entry?.date || '').trim();
  if (!date) {
    throw new Error('appendDietEntry requires date');
  }

  const { filePath, data } = readDietDailyRecord(dataDir, date);
  const mealType = normalizeMealType(entry?.meal_type || entry?.mealType);
  const time = String(entry?.time || inferTimeFromRecordedAt(entry?.recorded_at)).trim().slice(0, 5);
  const snackPeriod = mealType === 'snack'
    ? normalizeSnackPeriod(entry?.snack_period || entry?.snackPeriod) || inferSnackPeriodFromTime(time)
    : '';
  const slotKey = buildMealSlotKey(mealType, snackPeriod);
  const items = Array.isArray(entry?.items) ? entry.items.map(normalizeDietItem) : [];
  const fallbackDescription = String(entry?.description || entry?.raw_text || '').trim();

  const payload = {
    meal_type: mealType,
    snack_period: snackPeriod,
    slot_key: slotKey,
    time,
    description: computeDietDescription(items, fallbackDescription),
    source: entry?.source || 'text',
    items,
    meal_calories: toNumber(entry?.meal_calories),
    meal_protein_g: toNumber(entry?.meal_protein_g),
    meal_carb_g: toNumber(entry?.meal_carb_g),
    meal_fat_g: toNumber(entry?.meal_fat_g),
    recorded_at: entry?.recorded_at || '',
    channel: entry?.channel || '',
    sender_id: entry?.sender_id || '',
    sender_name: entry?.sender_name || '',
    raw_text: entry?.raw_text || '',
  };

  const existingMeal = data.meals.find(meal => meal.slot_key === slotKey);
  if (existingMeal) {
    existingMeal.items = [...existingMeal.items, ...payload.items];
    existingMeal.meal_calories = toNumber(existingMeal.meal_calories) + payload.meal_calories;
    existingMeal.meal_protein_g = toNumber(existingMeal.meal_protein_g) + payload.meal_protein_g;
    existingMeal.meal_carb_g = toNumber(existingMeal.meal_carb_g) + payload.meal_carb_g;
    existingMeal.meal_fat_g = toNumber(existingMeal.meal_fat_g) + payload.meal_fat_g;
    existingMeal.description = computeDietDescription(existingMeal.items, existingMeal.description || payload.description);
    existingMeal.source = existingMeal.source === payload.source ? existingMeal.source : 'mixed';
    existingMeal.recorded_at = payload.recorded_at || existingMeal.recorded_at || '';
    existingMeal.raw_text = [existingMeal.raw_text, payload.raw_text].filter(Boolean).join('\n');
    existingMeal.sender_id = payload.sender_id || existingMeal.sender_id || '';
    existingMeal.sender_name = payload.sender_name || existingMeal.sender_name || '';
    existingMeal.channel = payload.channel || existingMeal.channel || '';
    if (!existingMeal.time && payload.time) existingMeal.time = payload.time;
  } else {
    data.meals.push({
      id: makeDietMealId(),
      ...payload,
    });
  }

  data.meals.sort(sortByDateTime);
  data.total_calories = data.meals.reduce((sum, meal) => sum + toNumber(meal.meal_calories), 0);
  data.total_protein_g = data.meals.reduce((sum, meal) => sum + toNumber(meal.meal_protein_g), 0);
  data.total_carb_g = data.meals.reduce((sum, meal) => sum + toNumber(meal.meal_carb_g), 0);
  data.total_fat_g = data.meals.reduce((sum, meal) => sum + toNumber(meal.meal_fat_g), 0);
  delete data.legacy_format;

  writeJson(filePath, data);
  return { filePath, data };
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
  appendDietEntry,
  createEmptyDietDailyRecord,
  getPrimaryIdentity,
  getUserDataDir,
  getUserId,
  getUserIdentities,
  inferSnackPeriodFromTime,
  normalizeChannel,
  normalizeDietDailyRecord,
  normalizeMealType,
  normalizeSnackPeriod,
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
