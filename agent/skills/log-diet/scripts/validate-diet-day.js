#!/usr/bin/env node

const {
  buildDailyFilePath,
  isSupportedMealType,
  normalizeMealType,
  readJson,
  toNumber,
  writeJson,
} = require('./health-data-utils');

function printUsage() {
  console.error(`
Usage:
  node scripts/validate-diet-day.js \\
    --data-dir /Users/me/.health/<user_id> \\
    --date 2026-03-28 \\
    --meal-type lunch

Notes:
  - The script validates the existing day file, computes canonical totals, and writes them back.
  - Pass --meal-type to include the current merged meal in the output.
`);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = 'true';
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function required(value, name) {
  if (!String(value || '').trim()) {
    throw new Error(`missing required arg --${name}`);
  }
  return String(value).trim();
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').trim());
}

function isValidTime(value) {
  return /^\d{2}:\d{2}$/.test(String(value || '').trim());
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return ['items must be a non-empty array'];
  }

  return items.flatMap((item, index) => {
    const errors = [];
    if (!String(item?.name || '').trim()) {
      errors.push(`items[${index}].name is required`);
    }
    if (!String(item?.amount || item?.quantity || '').trim()) {
      errors.push(`items[${index}].amount is required`);
    }
    for (const [key, label] of [
      ['calories_est', 'calories_est'],
      ['protein_est_g', 'protein_est_g'],
      ['carb_est_g', 'carb_est_g'],
      ['fat_est_g', 'fat_est_g'],
    ]) {
      const value = item?.[key];
      if (value == null || value === '') {
        errors.push(`items[${index}].${label} is required`);
        continue;
      }
      if (!Number.isFinite(Number(value)) || Number(value) < 0) {
        errors.push(`items[${index}].${label} must be a non-negative number`);
      }
    }
    return errors;
  });
}

function normalizeItem(item = {}) {
  return {
    name: String(item?.name || '').trim(),
    amount: String(item?.amount || item?.quantity || '').trim(),
    calories_est: toNumber(item?.calories_est),
    protein_est_g: toNumber(item?.protein_est_g),
    carb_est_g: toNumber(item?.carb_est_g),
    fat_est_g: toNumber(item?.fat_est_g),
  };
}

function computeMealTotals(items) {
  return {
    meal_calories: items.reduce((sum, item) => sum + toNumber(item?.calories_est), 0),
    meal_protein_g: items.reduce((sum, item) => sum + toNumber(item?.protein_est_g), 0),
    meal_carb_g: items.reduce((sum, item) => sum + toNumber(item?.carb_est_g), 0),
    meal_fat_g: items.reduce((sum, item) => sum + toNumber(item?.fat_est_g), 0),
  };
}

function validateMeal(meal, index) {
  const errors = [];
  const mealType = normalizeMealType(meal?.meal_type || meal?.meal);

  if (!String(meal?.id || '').trim()) {
    errors.push(`meals[${index}].id is required`);
  }
  if (!isSupportedMealType(mealType)) {
    errors.push(`meals[${index}].meal_type must be one of breakfast, lunch, dinner, snack`);
  }
  if (!String(meal?.time || '').trim()) {
    errors.push(`meals[${index}].time is required`);
  } else if (!isValidTime(meal.time)) {
    errors.push(`meals[${index}].time must use HH:MM`);
  }
  if (!String(meal?.description || '').trim()) {
    errors.push(`meals[${index}].description is required`);
  }
  if (!['text', 'image', 'mixed'].includes(String(meal?.source || '').trim())) {
    errors.push(`meals[${index}].source must be text, image, or mixed`);
  }

  errors.push(...validateItems(meal?.items).map(error => `meals[${index}].${error}`));

  return errors;
}

function computeDailyTotals(meals) {
  return {
    total_calories: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_calories), 0),
    total_protein_g: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_protein_g), 0),
    total_carb_g: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_carb_g), 0),
    total_fat_g: meals.reduce((sum, meal) => sum + toNumber(meal?.meal_fat_g), 0),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printUsage();
    process.exit(0);
  }

  const dataDir = required(args['data-dir'], 'data-dir');
  const date = required(args.date, 'date');
  const mealType = normalizeMealType(args['meal-type'] || '');

  if (!isValidDate(date)) {
    throw new Error('date must use YYYY-MM-DD');
  }
  if (mealType && !isSupportedMealType(mealType)) {
    throw new Error('meal-type must be one of breakfast, lunch, dinner, snack');
  }

  const filePath = buildDailyFilePath(dataDir, 'diet', date);
  const raw = readJson(filePath);
  if (raw == null) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error_type: 'missing_file',
      errors: ['diet day file does not exist'],
      file_path: filePath,
      date,
      meal_type: mealType || null,
      meal: null,
      daily_totals: null,
      meals_count: 0,
    }, null, 2)}\n`);
    process.exit(2);
  }

  if (!raw || Array.isArray(raw) || typeof raw !== 'object') {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error_type: 'invalid_file',
      errors: ['diet day file must be a canonical JSON object'],
      file_path: filePath,
      date,
      meal_type: mealType || null,
      meal: null,
      daily_totals: null,
      meals_count: 0,
    }, null, 2)}\n`);
    process.exit(2);
  }

  const errors = [];
  if (String(raw.date || '').trim() !== date) {
    errors.push(`date must equal ${date}`);
  }
  if (!Array.isArray(raw.meals)) {
    errors.push('meals must be an array');
  }

  const meals = Array.isArray(raw.meals) ? raw.meals : [];
  meals.forEach((meal, index) => {
    errors.push(...validateMeal(meal, index));
  });

  const duplicateMealTypes = meals.reduce((map, meal) => {
    const key = normalizeMealType(meal?.meal_type || meal?.meal);
    if (!key) return map;
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map());

  for (const [key, count] of duplicateMealTypes.entries()) {
    if (count > 1) {
      errors.push(`meal_type ${key} appears ${count} times; each day may only keep one meal per meal_type`);
    }
  }

  const canonicalMeals = meals.map(meal => {
    const items = Array.isArray(meal?.items) ? meal.items.map(normalizeItem) : [];
    return {
      id: String(meal?.id || '').trim(),
      meal_type: normalizeMealType(meal?.meal_type || meal?.meal),
      time: String(meal?.time || '').trim(),
      description: String(meal?.description || '').trim(),
      source: String(meal?.source || '').trim(),
      items,
      ...computeMealTotals(items),
      channel: String(meal?.channel || '').trim(),
      sender_id: String(meal?.sender_id || '').trim(),
      sender_name: String(meal?.sender_name || '').trim(),
    };
  });

  const computedTotals = computeDailyTotals(canonicalMeals);

  const meal = mealType
    ? canonicalMeals.find(entry => normalizeMealType(entry?.meal_type || entry?.meal) === mealType) || null
    : null;
  if (mealType && !meal) {
    errors.push(`meal_type ${mealType} was not found in the day file`);
  }

  if (errors.length === 0) {
    writeJson(filePath, {
      date: String(raw.date || date).trim(),
      meals: canonicalMeals,
      ...computedTotals,
    });
  }

  const response = {
    ok: errors.length === 0,
    error_type: errors.length === 0 ? null : 'validation_error',
    errors,
    file_path: filePath,
    date: String(raw.date || date).trim(),
    meal_type: mealType || null,
    meal,
    daily_totals: computedTotals,
    meals_count: meals.length,
  };

  process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
  if (errors.length > 0) {
    process.exit(2);
  }
}

try {
  main();
} catch (error) {
  console.error(`validate-diet-day failed: ${error.message}`);
  process.exit(1);
}
