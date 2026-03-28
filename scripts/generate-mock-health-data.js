#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildDailyFilePath } = require('./health-data-utils');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const outputRoot = path.resolve(getArg('--output-dir', args[0] || path.join(repoRoot, 'mock-data', 'health')));
const totalDays = Number.parseInt(getArg('--days', '1095'), 10);

function getArg(name, fallback = '') {
  const index = args.indexOf(name);
  if (index === -1 || index === args.length - 1) return fallback;
  return args[index + 1];
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(hour, minute) {
  return `${pad(hour)}:${pad(minute)}`;
}

function round(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mulberry32(seed) {
  return function rand() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

const users = [
  {
    user_id: '11111111-1111-4111-8111-111111111111',
    username: 'momo',
    name: 'Momo',
    role: 'member',
    dashboard_token: 'mock-dashboard-momo',
    daily_report_target: 'telegram:dm:mock_user_001',
    identities: [
      { channel: 'telegram', sender_id: 'mock_user_001' },
      { channel: 'feishu', sender_id: 'ou_mock_user_001' },
    ],
    profile: {
      daily_calorie_target: 2100,
      protein_target_g: 145,
      carb_target_g: 250,
      fat_target_g: 70,
      weekly_workout_target: 4,
    },
    baseWeight: 79.4,
    trendPerDay: -0.008,
    seed: 101,
  },
  {
    user_id: '22222222-2222-4222-8222-222222222222',
    username: 'luna',
    name: 'Luna',
    role: 'member',
    dashboard_token: 'mock-dashboard-luna',
    daily_report_target: 'telegram:dm:mock_user_002',
    identities: [
      { channel: 'telegram', sender_id: 'mock_user_002' },
      { channel: 'feishu', sender_id: 'ou_mock_user_002' },
    ],
    profile: {
      daily_calorie_target: 1850,
      protein_target_g: 120,
      carb_target_g: 210,
      fat_target_g: 60,
      weekly_workout_target: 3,
    },
    baseWeight: 63.8,
    trendPerDay: 0.002,
    seed: 202,
  },
];

function hasUserId(user, targetUserId) {
  return user.user_id === targetUserId;
}

function buildMeals(dayOffset, user) {
  const rand = mulberry32(user.seed + dayOffset * 17);
  const meals = [];
  const breakfast = {
    id: 'meal_001',
    meal_type: 'breakfast',
    time: formatTime(8, 10),
    description: '燕麦酸奶碗 + 水煮蛋',
    source: 'text',
    items: [
      { name: '燕麦酸奶碗', amount: '1 碗', calories_est: 360 + Math.round(rand() * 40), protein_est_g: 22, carb_est_g: 42, fat_est_g: 12 },
      { name: '水煮蛋', amount: '2 个', calories_est: 140, protein_est_g: 12, carb_est_g: 1, fat_est_g: 10 },
    ],
  };
  const lunchProtein = hasUserId(user, '11111111-1111-4111-8111-111111111111') ? '鸡胸肉藜麦饭' : '三文鱼饭';
  const lunch = {
    id: 'meal_002',
    meal_type: 'lunch',
    time: formatTime(12, 25),
    description: `${lunchProtein} + 时蔬`,
    source: 'image',
    items: [
      { name: lunchProtein, amount: '1 份', calories_est: 520 + Math.round(rand() * 70), protein_est_g: 38, carb_est_g: 54, fat_est_g: 18 },
      { name: '时蔬', amount: '1 份', calories_est: 90, protein_est_g: 4, carb_est_g: 10, fat_est_g: 4 },
    ],
  };
  const dinner = {
    id: 'meal_003',
    meal_type: 'dinner',
    time: formatTime(19, 5),
    description: hasUserId(user, '11111111-1111-4111-8111-111111111111') ? '牛肉意面 + 沙拉' : '豆腐饭 + 炒青菜',
    source: 'text',
    items: hasUserId(user, '11111111-1111-4111-8111-111111111111')
      ? [
          { name: '牛肉意面', amount: '1 盘', calories_est: 640 + Math.round(rand() * 80), protein_est_g: 36, carb_est_g: 66, fat_est_g: 22 },
          { name: '蔬菜沙拉', amount: '1 碗', calories_est: 110, protein_est_g: 3, carb_est_g: 8, fat_est_g: 7 },
        ]
      : [
          { name: '豆腐饭', amount: '1 份', calories_est: 470 + Math.round(rand() * 60), protein_est_g: 25, carb_est_g: 58, fat_est_g: 14 },
          { name: '炒青菜', amount: '1 份', calories_est: 95, protein_est_g: 4, carb_est_g: 9, fat_est_g: 5 },
        ],
  };
  meals.push(breakfast, lunch, dinner);

  if ((dayOffset + user.seed) % 3 === 0) {
    meals.push({
      id: 'meal_004',
      meal_type: 'snack',
      time: formatTime(16, 20),
      description: '蛋白奶昔 + 香蕉',
      source: 'text',
      items: [
        { name: '蛋白奶昔', amount: '1 杯', calories_est: 180, protein_est_g: 24, carb_est_g: 8, fat_est_g: 4 },
        { name: '香蕉', amount: '1 根', calories_est: 105, protein_est_g: 1, carb_est_g: 27, fat_est_g: 0 },
      ],
    });
  }

  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarb = 0;
  let totalFat = 0;
  for (const meal of meals) {
    meal.meal_calories = meal.items.reduce((sum, item) => sum + item.calories_est, 0);
    meal.meal_protein_g = meal.items.reduce((sum, item) => sum + item.protein_est_g, 0);
    meal.meal_carb_g = meal.items.reduce((sum, item) => sum + item.carb_est_g, 0);
    meal.meal_fat_g = meal.items.reduce((sum, item) => sum + item.fat_est_g, 0);
    totalCalories += meal.meal_calories;
    totalProtein += meal.meal_protein_g;
    totalCarb += meal.meal_carb_g;
    totalFat += meal.meal_fat_g;
  }

  return {
    meals,
    total_calories: totalCalories,
    total_protein_g: totalProtein,
    total_carb_g: totalCarb,
    total_fat_g: totalFat,
  };
}

function buildWorkout(dayOffset, user) {
  const pattern = (dayOffset + user.seed) % 4;
  if (pattern === 1) return null;

  const strengthWeight = hasUserId(user, '11111111-1111-4111-8111-111111111111') ? 85 : 45;
  const exercises = [
    {
      id: 'ex_001',
      time: formatTime(18, 30),
      name: hasUserId(user, '11111111-1111-4111-8111-111111111111') ? '深蹲' : '臀桥',
      category: 'strength',
      sets: [1, 2, 3, 4].map(setNo => ({ set_no: setNo, reps: 8 + (dayOffset % 3), weight_kg: strengthWeight + setNo * 2 })),
    },
    {
      id: 'ex_002',
      time: formatTime(19, 0),
      name: hasUserId(user, '11111111-1111-4111-8111-111111111111') ? '卧推' : '划船机',
      category: hasUserId(user, '11111111-1111-4111-8111-111111111111') ? 'strength' : 'cardio',
      sets: hasUserId(user, '11111111-1111-4111-8111-111111111111')
        ? [1, 2, 3, 4].map(setNo => ({ set_no: setNo, reps: 6 + (dayOffset % 2), weight_kg: 62 + setNo * 2 }))
        : [],
      duration_min: hasUserId(user, '11111111-1111-4111-8111-111111111111') ? undefined : 32 + (dayOffset % 8),
    },
  ];

  for (const ex of exercises) {
    ex.total_volume_kg = Array.isArray(ex.sets)
      ? ex.sets.reduce((sum, set) => sum + set.reps * set.weight_kg, 0)
      : 0;
  }

  return { exercises };
}

ensureDir(outputRoot);
fs.rmSync(outputRoot, { recursive: true, force: true });
ensureDir(outputRoot);
writeJson(path.join(outputRoot, 'invites.json'), { invites: [] });
writeJson(path.join(outputRoot, 'sync_lock.json'), { pending: false });
writeJson(path.join(outputRoot, 'users.json'), {
  users: users.map(user => ({
    user_id: user.user_id,
    username: user.username,
    identities: user.identities,
    name: user.name,
    role: user.role,
    status: 'active',
    dashboard_token: user.dashboard_token,
    daily_report_target: user.daily_report_target,
    registered_at: formatDate(isoDaysAgo(totalDays - 1)),
    last_active_at: formatDate(new Date()),
  })),
});

for (const user of users) {
  const userDir = path.join(outputRoot, user.user_id);
  ensureDir(userDir);
  writeJson(path.join(userDir, 'profile.json'), user.profile);

  for (let offset = totalDays - 1; offset >= 0; offset -= 1) {
    const dateObj = isoDaysAgo(offset);
    const date = formatDate(dateObj);
    const elapsedDays = totalDays - 1 - offset;
    const monthlyWave = Math.sin(elapsedDays / 14) * (hasUserId(user, '11111111-1111-4111-8111-111111111111') ? 0.35 : 0.24);
    const longWave = Math.sin(elapsedDays / 90) * (hasUserId(user, '11111111-1111-4111-8111-111111111111') ? 0.8 : 0.55);
    const weight = round(user.baseWeight + user.trendPerDay * elapsedDays + monthlyWave + longWave, 1);
    writeJson(buildDailyFilePath(userDir, 'weight', date), {
      date,
      time: formatTime(7, 15 + (offset % 20)),
      weight_kg: weight,
      source: 'manual',
    });

    const diet = buildMeals(offset, user);
    writeJson(buildDailyFilePath(userDir, 'diet', date), {
      date,
      meals: diet.meals,
      total_calories: diet.total_calories,
      total_protein_g: diet.total_protein_g,
      total_carb_g: diet.total_carb_g,
      total_fat_g: diet.total_fat_g,
    });

    const workout = buildWorkout(offset, user);
    if (workout) {
      writeJson(buildDailyFilePath(userDir, 'workout', date), {
        date,
        exercises: workout.exercises,
      });
    }
  }
}

console.log(`mock health data written to ${outputRoot}`);
console.log('users:');
for (const user of users) {
  console.log(`- ${user.name} (${user.user_id}) token=${user.dashboard_token}`);
}
