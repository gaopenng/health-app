# Workout file format

Write `workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`.

```json
{
  "date": "2026-03-24",
  "exercises": [
    {
      "id": "ex_001",
      "time": "09:00",
      "name": "卧推",
      "category": "strength",
      "sets": [
        {"set_no": 1, "reps": 10, "weight_kg": 80},
        {"set_no": 2, "reps": 10, "weight_kg": 80}
      ],
      "total_volume_kg": 1600
    },
    {
      "id": "ex_002",
      "time": "09:30",
      "name": "跑步",
      "category": "cardio",
      "sets": [],
      "duration_min": 30,
      "total_volume_kg": 0
    }
  ]
}
```
