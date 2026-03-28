#!/usr/bin/env node

const {
  isValidDate,
  isValidTime,
  readWorkoutDailyRecord,
  toNumber,
  writeJson,
} = require('./health-data-utils');

function printUsage() {
  console.error([
    'Usage:',
    '  node scripts/append-workout-entry.js \\',
    '    --data-dir /Users/me/.health/<user_id> \\',
    '    --date 2026-03-28 \\',
    '    --time 09:00 \\',
    '    --exercise-json \'{"name":"卧推","category":"strength","sets":[{"set_no":1,"reps":10,"weight_kg":80}]}\'',
    '',
    'Or:',
    '  node scripts/append-workout-entry.js \\',
    '    --payload-json \'{"data_dir":"~/.health/<user_id>","date":"2026-03-28","time":"09:00","exercise":{"name":"跑步","category":"cardio","duration_min":40}}\'',
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

function makeExerciseId() {
  return `ex_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeCategory(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'strength' || raw === 'cardio') return raw;
  return '';
}

function normalizeSets(sets) {
  if (!Array.isArray(sets)) return [];
  return sets.map((set, index) => ({
    set_no: Number.isFinite(Number(set?.set_no)) ? Number(set.set_no) : index + 1,
    reps: Number.isFinite(Number(set?.reps)) ? Number(set.reps) : 0,
    weight_kg: Number.isFinite(Number(set?.weight_kg)) ? Number(set.weight_kg) : 0,
  }));
}

function computeTotalVolumeKg(exercise) {
  if (!Array.isArray(exercise.sets)) return 0;
  return exercise.sets.reduce((sum, set) => sum + (Number(set.reps) || 0) * (Number(set.weight_kg) || 0), 0);
}

function validateExercise(exercise) {
  const errors = [];
  const category = normalizeCategory(exercise?.category);
  const sets = normalizeSets(exercise?.sets);
  const durationMin = Number.isFinite(Number(exercise?.duration_min)) ? Number(exercise.duration_min) : 0;
  const normalized = {
    name: String(exercise?.name || '').trim(),
    category,
    sets,
    duration_min: durationMin,
  };

  if (!normalized.name) errors.push('exercise.name is required');
  if (!category) errors.push('exercise.category must be strength or cardio');

  if (category === 'strength') {
    if (!sets.length) errors.push('strength exercise requires at least one set');
    sets.forEach((set, index) => {
      if (!Number.isFinite(set.reps) || set.reps <= 0) errors.push(`exercise.sets[${index}].reps must be positive`);
      if (!Number.isFinite(set.weight_kg) || set.weight_kg < 0) errors.push(`exercise.sets[${index}].weight_kg must be non-negative`);
    });
  }

  if (category === 'cardio' && (!Number.isFinite(durationMin) || durationMin <= 0)) {
    errors.push('cardio exercise requires positive duration_min');
  }

  normalized.total_volume_kg = category === 'strength' ? computeTotalVolumeKg(normalized) : 0;
  return { ok: errors.length === 0, errors, normalized };
}

function validatePayload(payload) {
  const errors = [];
  const normalized = {
    data_dir: String(payload.data_dir || payload.dataDir || '').trim(),
    date: String(payload.date || '').trim(),
    time: String(payload.time || '').trim(),
    exercise: payload.exercise || null,
  };

  if (!normalized.data_dir) errors.push('data_dir is required');
  if (!isValidDate(normalized.date)) errors.push('date must use YYYY-MM-DD');
  if (!isValidTime(normalized.time)) errors.push('time must use HH:MM');
  if (!normalized.exercise || typeof normalized.exercise !== 'object') errors.push('exercise is required');

  let exerciseValidation = { ok: false, errors: ['exercise is required'], normalized: null };
  if (normalized.exercise && typeof normalized.exercise === 'object') {
    exerciseValidation = validateExercise(normalized.exercise);
    errors.push(...exerciseValidation.errors);
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      ...normalized,
      exercise: exerciseValidation.normalized,
    },
  };
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
        exercise: parseJsonArg(args['exercise-json'], null),
      };

  const validation = validatePayload(payload);
  if (!validation.ok) {
    process.stdout.write(`${JSON.stringify({ ok: false, error_type: 'validation_error', errors: validation.errors, normalized: validation.normalized }, null, 2)}\n`);
    process.exit(2);
  }

  const { data_dir, date, time, exercise } = validation.normalized;
  const { filePath, data } = readWorkoutDailyRecord(data_dir, date);
  const record = {
    id: makeExerciseId(),
    time,
    name: exercise.name,
    category: exercise.category,
    sets: exercise.category === 'strength' ? exercise.sets : [],
    duration_min: exercise.category === 'cardio' ? exercise.duration_min : undefined,
    total_volume_kg: exercise.total_volume_kg,
  };

  data.exercises.push(record);
  data.exercises.sort((a, b) => `${date}T${a.time || '00:00'}`.localeCompare(`${date}T${b.time || '00:00'}`));
  writeJson(filePath, data);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    file_path: filePath,
    record,
    daily_exercise_count: data.exercises.length,
  }, null, 2)}\n`);
}

try {
  main();
} catch (error) {
  console.error(`append-workout-entry failed: ${error.message}`);
  process.exit(1);
}
