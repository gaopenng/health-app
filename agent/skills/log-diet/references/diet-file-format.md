# Diet file format

The script writes `diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`.

## Slot rules

Allowed slot keys:

- `breakfast`
- `lunch`
- `dinner`
- `snack:morning`
- `snack:afternoon`
- `snack:evening`

If the same slot is logged again on the same day, merge it into the existing slot instead of creating a duplicate meal slot.

## Example

```json
{
  "date": "2026-03-24",
  "meals": [
    {
      "id": "meal_001",
      "meal_type": "lunch",
      "slot_key": "lunch",
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
