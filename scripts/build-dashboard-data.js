#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  getUserDataDir,
  getUserId,
  readDailyRecords,
  readJson,
  readUsers,
  resolveUser,
  sortByDateTime,
} = require('./health-data-utils');

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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function readWeightHistory(userDir, cutoffDate) {
  return readDailyRecords(userDir, 'weight', cutoffDate)
    .map(entry => ({ date: entry.date, weight_kg: entry.weight_kg }));
}

function readDietMap(userDir) {
  const map = new Map();
  for (const entry of readDailyRecords(userDir, 'diet')) {
    map.set(entry.date, entry);
  }
  return map;
}

function readWorkoutMap(userDir) {
  const map = new Map();
  for (const entry of readDailyRecords(userDir, 'workout')) {
    map.set(entry.date, entry);
  }
  return map;
}

function aggregateUser(user, healthDataDir, days) {
  const userDir = getUserDataDir(healthDataDir, user);
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
    user: {
      user_id: getUserId(user),
      sender_id: user.sender_id,
      channel: user.channel,
      identities: user.identities,
      name: user.name,
    },
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
  const userIdFilter = getArg('--user-id');
  const senderIdFilter = getArg('--sender-id');
  const channelFilter = getArg('--channel');
  const users = readUsers(healthDataDir);
  const activeUsers = users.filter(user => user.status === 'active' && user.dashboard_token);
  let targetUsers = activeUsers;

  if (userIdFilter) {
    targetUsers = activeUsers.filter(user => getUserId(user) === userIdFilter);
  } else if (senderIdFilter) {
    const user = resolveUser(activeUsers, { senderId: senderIdFilter, channel: channelFilter });
    targetUsers = user ? [user] : [];
  }

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
  console.log('Usage: node scripts/build-dashboard-data.js [--health-data-dir DIR] [--output-dir DIR] [--days 30] [--user-id ID] [--sender-id ID] [--channel CHANNEL]');
  process.exit(0);
}

main();
