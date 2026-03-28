# Diet payload schema

Pass a payload to `scripts/append-diet-entry.js` with these fields:

- `data_dir`
- `date` in `YYYY-MM-DD`
- `time` in `HH:MM`
- `meal_type` in `{breakfast,lunch,dinner,snack}`
- `snack_period` in `{morning,afternoon,evening}` when `meal_type=snack`
- `description`
- `items` as a non-empty array; each item must include at least `name` and `amount`
- `meal_calories`
- `meal_protein_g`
- `meal_carb_g`
- `meal_fat_g`
- `source` in `{text,image}`
- `channel`
- `sender_id`
- `sender_name`
- `raw_text`

## Notes

- `user_id` does not need to enter the payload when `data_dir` already points to the user's directory.
- `reply_target` is for routing only and should not be written into the diet file.
