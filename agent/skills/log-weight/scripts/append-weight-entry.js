#!/usr/bin/env node

const {
  buildDailyFilePath,
  isValidDate,
  isValidTime,
  readDailyRecords,
  toNumber,
  writeJson,
} = require('./health-data-utils');

function printUsage() {
  console.error([
    'Usage:',
    '  node scripts/append-weight-entry.js \\',
    '    --data-dir /Users/me/.health/<user_id> \\',
    '    --date 2026-03-28 \\',
    '    --time 08:00 \\',
    '    --weight-kg 75.2 \\',
    '    --source manual',
    '',
    'Or:',
    '  node scripts/append-weight-entry.js \\',
    '    --payload-json \'{"data_dir":"~/.health/<user_id>","date":"2026-03-28","time":"08:00","weight_kg":75.2,"source":"manual"}\'',
  ].join('\n'));
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

function nowLocal() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

function normalizeSource(value) {
  return String(value || 'manual').trim() || 'manual';
}

function validateInput(payload) {
  const errors = [];
  const normalized = {
    data_dir: String(payload.data_dir || payload.dataDir || '').trim(),
    date: String(payload.date || '').trim(),
    time: String(payload.time || '').trim(),
    weight_kg: toNumber(payload.weight_kg),
    source: normalizeSource(payload.source),
  };

  if (!normalized.data_dir) errors.push('data_dir is required');
  if (!isValidDate(normalized.date)) errors.push('date must use YYYY-MM-DD');
  if (!isValidTime(normalized.time)) errors.push('time must use HH:MM');
  if (!Number.isFinite(normalized.weight_kg) || normalized.weight_kg <= 0) {
    errors.push('weight_kg must be a positive number');
  }

  return { ok: errors.length === 0, errors, normalized };
}

function getLatestPriorRecord(dataDir, date) {
  const records = readDailyRecords(dataDir, 'weight')
    .filter(record => record.date && record.date < date)
    .sort((a, b) => `${b.date}T${b.time || '00:00'}`.localeCompare(`${a.date}T${a.time || '00:00'}`));
  return records[0] || null;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printUsage();
    process.exit(0);
  }

  const now = nowLocal();
  const payload = args['payload-json']
    ? parseJsonArg(args['payload-json'])
    : {
        data_dir: args['data-dir'],
        date: args.date || now.date,
        time: args.time || now.time,
        weight_kg: args['weight-kg'],
        source: args.source || 'manual',
      };

  const validation = validateInput(payload);
  if (!validation.ok) {
    process.stdout.write(`${JSON.stringify({ ok: false, error_type: 'validation_error', errors: validation.errors, normalized: validation.normalized }, null, 2)}\n`);
    process.exit(2);
  }

  const { data_dir, date, time, weight_kg, source } = validation.normalized;
  const latestPrior = getLatestPriorRecord(data_dir, date);
  const filePath = buildDailyFilePath(data_dir, 'weight', date);
  const data = { date, time, weight_kg, source };
  writeJson(filePath, data);

  const deltaKg = latestPrior && Number.isFinite(Number(latestPrior.weight_kg))
    ? Number((weight_kg - Number(latestPrior.weight_kg)).toFixed(1))
    : null;

  process.stdout.write(`${JSON.stringify({
    ok: true,
    file_path: filePath,
    record: data,
    latest_prior: latestPrior ? {
      date: latestPrior.date,
      time: latestPrior.time || '',
      weight_kg: latestPrior.weight_kg,
      source: latestPrior.source || '',
    } : null,
    delta_kg: deltaKg,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(`append-weight-entry failed: ${error.message}`);
  process.exit(1);
}
