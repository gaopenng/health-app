# Workout payload schema

Pass a payload to `scripts/append-workout-entry.js` with these fields:

- `data_dir`
- `date` in `YYYY-MM-DD`
- `time` in `HH:MM`
- `exercise` object

## Exercise object

Required:

- `name`
- `category` in `{strength,cardio}`

For strength:

- `sets` as a non-empty array of objects with:
  - `set_no`
  - `reps`
  - `weight_kg`

For cardio:

- `duration_min` as a positive number

## Notes

- The script computes `total_volume_kg` for strength exercises.
- The script appends a single normalized exercise record per invocation.
