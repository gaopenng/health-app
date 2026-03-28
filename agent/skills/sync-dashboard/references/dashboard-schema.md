# Dashboard schema

Write `{dashboard_data_dir}/{token}.json` with a structure like:

```json
{
  "generated_at": "2026-03-24T21:05:00",
  "profile": {
    "daily_calorie_target": 2000,
    "protein_target_g": 120,
    "weekly_workout_target": 3
  },
  "weight_history": [
    {"date": "2026-03-18", "weight_kg": 76.0},
    {"date": "2026-03-24", "weight_kg": 75.2}
  ],
  "daily_stats": [
    {
      "date": "2026-03-24",
      "calories": 1327,
      "protein_g": 82,
      "carb_g": 160,
      "fat_g": 45,
      "workout_count": 2,
      "trained": true
    }
  ],
  "recent_workouts": [
    {
      "date": "2026-03-24",
      "exercises": ["卧推", "深蹲", "跑步"]
    }
  ]
}
```
