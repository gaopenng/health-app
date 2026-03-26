# sync-dashboard

Dashboard 数据同步 Skill，将用户健康数据聚合为静态 JSON 并 git push 触发 Cloudflare Pages 构建。

每次 log-* skill 记录后异步触发，内置 5 分钟合并窗口避免构建次数超额。

## 触发方式

由 log-diet / log-workout / log-weight 异步调用，无需手动触发。

## 执行流程

```
1. 读取 /Users/gaopeng/.health/sync_lock.json，检查是否存在待执行的构建请求
   结构：{"pending": true, "scheduled_at": "2026-03-24T12:30:00"}

2. 若 pending=false 或文件不存在：
   - 写入 sync_lock.json：{pending: true, scheduled_at: now+5min}
   - 等待 5 分钟
   - 进入步骤 3

3. 若 pending=true 且 scheduled_at 未到：
   - 本次直接返回（5 分钟内已有人会触发构建）

4. 构建执行：
   a. 遍历 /Users/gaopeng/.health/users.json 中所有 status=active 的用户
   b. 为每个用户聚合数据，生成 {dashboard_data_dir}/{token}.json：
      - 最近 30 天体重数据
      - 最近 30 天每日热量 / 蛋白质 / 碳水 / 脂肪
      - 最近 30 天训练频率（是否训练）
      - 最近 7 天宏量营养素均值
      - 最近训练动作列表
      - profile 目标值
   c. git add . && git commit -m "update dashboard data" && git push
      → 触发 Cloudflare Pages 自动构建（10–30s）
   d. 重置 sync_lock.json：{pending: false}
```

## 聚合数据格式

写入 `{dashboard_data_dir}/{token}.json`：

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

## 免费额度说明

| 限制项 | 免费额度 | 实际用量（5 用户，合并后） |
|--------|---------|--------------------------|
| 每月构建次数 | 500 次 | ~180 次 |
| 带宽/请求 | 无限制 | — |
