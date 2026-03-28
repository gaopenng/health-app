# Diet file format

直接写入绝对路径 `{data_dir}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`。

## Top-level fields

- `date`: `YYYY-MM-DD`
- `meals`: array
- `total_calories`: number
- `total_protein_g`: number
- `total_carb_g`: number
- `total_fat_g`: number

顶层四个 `total_*` 必须等于 `meals` 中所有餐次对应营养字段的求和。
这些顶层 `total_*` 由 `validate-diet-day.js` 计算并回写，模型不需要手算。

## Meal type rules

Allowed meal types:

- `breakfast`
- `lunch`
- `dinner`
- `snack`

If the same `meal_type` is logged again on the same day, merge it into the existing meal instead of creating a duplicate meal entry.

## Meal object fields

Each item in `meals` should use this shape:

- `id`: unique string within the day file
- `meal_type`: `breakfast` | `lunch` | `dinner` | `snack`
- `time`: `HH:MM`
- `description`: short human-readable summary of the meal
- `source`: `text` | `image` | `mixed`
- `items`: non-empty array
- `meal_calories`: number
- `meal_protein_g`: number
- `meal_carb_g`: number
- `meal_fat_g`: number
- `channel`: optional string
- `sender_id`: optional string
- `sender_name`: optional string

Each item inside `items` should include:

- `name`
- `amount`
- `calories_est`
- `protein_est_g`
- `carb_est_g`
- `fat_est_g`

`meal_*` 字段由 `validate-diet-day.js` 根据 `items` 中的估算值求和得到，模型不需要手算。

## Writing rules

- If the day file does not exist, create a new canonical object in this format.
- If the day file already exists, read it first and update it in place.
- Never create two `meals` entries with the same `meal_type` on the same date.
- When merging into an existing meal type, append new `items`; the script will recompute that meal's `meal_*` fields afterward.
- After every write, run `validate-diet-day.js` so it computes and rewrites canonical `meal_*` and top-level `total_*`.
- Do not write routing-only fields such as `reply_target` or unrelated identifiers such as `user_id` into the diet file.

## Example

```json
{
  "date": "2026-03-24",
  "meals": [
    {
      "id": "meal_001",
      "meal_type": "lunch",
      "time": "12:30",
      "description": "米饭 + 鸡胸肉",
      "source": "image",
      "items": [
        {
          "name": "米饭",
          "amount": "200g",
          "calories_est": 232,
          "protein_est_g": 4,
          "carb_est_g": 51,
          "fat_est_g": 0.5
        }
      ],
      "meal_calories": 397,
      "meal_protein_g": 35,
      "meal_carb_g": 51,
      "meal_fat_g": 4.1
    }
  ],
  "total_calories": 577,
  "total_protein_g": 46,
  "total_carb_g": 69,
  "total_fat_g": 8.1
}
```
