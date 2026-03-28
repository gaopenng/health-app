#!/usr/bin/env node

const {
  appendDietEntry,
} = require('./health-data-utils');

function printUsage() {
  console.error(`
Usage:
  node scripts/append-diet-entry.js \\
    --data-dir /Users/me/.health/<user_id> \\
    --date 2026-03-28 \\
    --meal-type breakfast \\
    --description "双蛋肠粉" \\
    --items-json '[{"name":"双蛋肠粉","amount":"1份"}]' \\
    --meal-calories 450 \\
    --meal-protein-g 19 \\
    --meal-carb-g 42 \\
    --meal-fat-g 22

Notes:
  - breakfast / lunch / dinner 会写入对应餐次槽位。
  - snack 需要搭配 --snack-period morning|afternoon|evening。
  - 同一天同一槽位会自动追加，不会覆盖原来的 items。
  - 旧版数组格式文件会自动迁移为统一的新格式后再追加。
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

function parseJsonArg(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`invalid JSON: ${error.message}`);
  }
}

function required(value, name) {
  if (!String(value || '').trim()) {
    throw new Error(`missing required arg --${name}`);
  }
  return String(value).trim();
}

function nowLocalDateTime() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    recordedAt: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printUsage();
    process.exit(0);
  }

  const now = nowLocalDateTime();
  const dataDir = required(args['data-dir'], 'data-dir');
  const date = String(args.date || now.date).trim();
  const mealType = required(args['meal-type'], 'meal-type');
  const items = parseJsonArg(args['items-json'], []);

  const result = appendDietEntry(dataDir, {
    date,
    meal_type: mealType,
    snack_period: args['snack-period'] || '',
    time: args.time || now.time,
    description: args.description || '',
    source: args.source || 'text',
    items,
    meal_calories: args['meal-calories'],
    meal_protein_g: args['meal-protein-g'],
    meal_carb_g: args['meal-carb-g'],
    meal_fat_g: args['meal-fat-g'],
    recorded_at: args['recorded-at'] || now.recordedAt,
    channel: args.channel || '',
    sender_id: args['sender-id'] || '',
    sender_name: args['sender-name'] || '',
    raw_text: args['raw-text'] || '',
  });

  process.stdout.write(`${JSON.stringify({
    ok: true,
    file: result.filePath,
    date: result.data.date,
    meals: result.data.meals.length,
    total_calories: result.data.total_calories,
    total_protein_g: result.data.total_protein_g,
    total_carb_g: result.data.total_carb_g,
    total_fat_g: result.data.total_fat_g,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(`append-diet-entry failed: ${error.message}`);
  process.exit(1);
}
