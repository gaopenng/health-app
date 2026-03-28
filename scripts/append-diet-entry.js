#!/usr/bin/env node

const {
  appendDietEntry,
  validateDietToolInput,
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

Or:
  node scripts/append-diet-entry.js \\
    --payload-json '{"data_dir":"~/.health/<user_id>","date":"2026-03-28","meal_type":"breakfast","items":[{"name":"双蛋肠粉","amount":"1份"}],"meal_calories":450,"meal_protein_g":19,"meal_carb_g":42,"meal_fat_g":22}'

Notes:
  - breakfast / lunch / dinner 会写入对应餐次槽位。
  - snack 需要搭配 --snack-period morning|afternoon|evening。
  - 同一天同一槽位会自动追加，不会覆盖原来的 items。
  - 旧版数组格式文件会自动迁移为统一的新格式后再追加。
  - 推荐模型统一构造 payload-json，再调用这个工具。
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

function toNumber(value) {
  if (value == null || value === '') return '';
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
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
  const payload = args['payload-json']
    ? parseJsonArg(args['payload-json'])
    : {
        data_dir: args['data-dir'],
        date: args.date || now.date,
        meal_type: args['meal-type'],
        snack_period: args['snack-period'] || '',
        time: args.time || now.time,
        description: args.description || '',
        source: args.source || 'text',
        items: parseJsonArg(args['items-json'], []),
        meal_calories: toNumber(args['meal-calories']),
        meal_protein_g: toNumber(args['meal-protein-g']),
        meal_carb_g: toNumber(args['meal-carb-g']),
        meal_fat_g: toNumber(args['meal-fat-g']),
        recorded_at: args['recorded-at'] || now.recordedAt,
        channel: args.channel || '',
        sender_id: args['sender-id'] || '',
        sender_name: args['sender-name'] || '',
        raw_text: args['raw-text'] || '',
      };

  const validation = validateDietToolInput(payload);
  if (!validation.ok) {
    process.stdout.write(`${JSON.stringify({
      ok: false,
      error_type: 'validation_error',
      errors: validation.errors,
      normalized: validation.normalized,
    }, null, 2)}\n`);
    process.exit(2);
  }

  const dataDir = required(payload.data_dir || payload.dataDir, 'data-dir');
  const result = appendDietEntry(dataDir, {
    ...payload,
    date: String(payload.date || now.date).trim(),
    meal_type: payload.meal_type,
    snack_period: payload.snack_period || '',
    time: payload.time || now.time,
    recorded_at: payload.recorded_at || now.recordedAt,
  });

  const slotKey = validation.normalized.slot_key;
  const slot = result.data.meals.find(meal => meal.slot_key === slotKey) || null;

  process.stdout.write(`${JSON.stringify({
    ok: true,
    file_path: result.filePath,
    date: result.data.date,
    slot_key: slotKey,
    slot,
    daily_totals: {
      total_calories: result.data.total_calories,
      total_protein_g: result.data.total_protein_g,
      total_carb_g: result.data.total_carb_g,
      total_fat_g: result.data.total_fat_g,
    },
    meals_count: result.data.meals.length,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(`append-diet-entry failed: ${error.message}`);
  process.exit(1);
}
