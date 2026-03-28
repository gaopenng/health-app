# Diet validation script

Use `scripts/validate-diet-day.js` after writing the day file.
The model does not need to calculate `meal_*` or top-level `total_*`; this script derives them from item estimates and writes canonical totals back into the file.

## Usage

```bash
node scripts/validate-diet-day.js \
  --data-dir /Users/me/.health/<user_id> \
  --date 2026-03-28 \
  --meal-type lunch
```

## Required args

- `--data-dir`
- `--date`

## Optional args

- `--meal-type`: return the merged meal object for the current write target

## Output

Successful validation returns JSON with:

- `ok: true`
- `file_path`
- `date`
- `meal_type`
- `meal`
- `daily_totals`
- `meals_count`

Failed validation returns JSON with:

- `ok: false`
- `error_type`
- `errors`
- `file_path`
- `date`
- `meal_type`
- `meal`
- `daily_totals`

Always use the script's `daily_totals` as the source of truth for the confirmation message.
