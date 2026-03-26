# daily-report

每日日报 Skill，由 Cron 在每天 21:00 触发，为所有活跃用户生成并推送当日健康摘要。

## 触发方式

OpenClaw Cron，表达式：`every day at 21:00`

Cron prompt：
```
执行每日日报推送任务。读取 $HEALTH_DATA_DIR/users.json，
对所有 status=active 的用户，调用 daily-report skill，
传入各自的 sender_id，逐一生成并推送日报。
```

## 输入参数

| 参数 | 必填 | 说明 |
|------|------|------|
| `user_sender_id` | ✅ | 用户 ID |
| `data_dir` | ✅ | 用户数据目录 |

## 执行流程

```
1. 读取 {data_dir}/diet/YYYY-MM-DD.json → 饮食摘要
2. 读取 {data_dir}/workout/YYYY-MM-DD.json → 训练摘要（文件不存在则标记"今日未训练"）
3. 遍历最近 7 天读取最近一次 weight/YYYY-MM-DD.json → 体重
4. 读取 {data_dir}/profile.json → 获取目标值

5. 用 LLM 基于当日数据生成 1 条具体个性化建议
   优先分析：蛋白质缺口 / 热量超标 / 训练频率 / 体重趋势

6. 组装日报消息（格式见下）

7. 读取 $HEALTH_DATA_DIR/users.json 中该用户的 daily_report_target 字段：
   - "group:{群组ID}" → 推送到群组
   - "dm:{sender_id}" → 推送到私聊

8. 附上专属 Dashboard 链接（从 users.json 读取 dashboard_token）
```

## 回复格式

### Telegram（文字）

```
📊 今日健康日报 · 2026-03-24

🥗 饮食摘要
早餐  350 kcal
午餐  397 kcal
晚餐  580 kcal
合计  1327 / 2000 kcal  ▓▓▓▓▓▓░░░░ 66%
蛋白质 ~82g / 目标 120g  ⚠️ 偏低

🏋️ 训练摘要
卧推  5×10 @ 80kg
深蹲  4×8  @ 100kg

⚖️ 体重
75.2 kg（较昨日 ↓ 0.6 kg）

💡 今日建议
蛋白质缺口约 38g，睡前可补充一杯蛋白粉

[📊 查看完整数据看板]
```

### 飞书（消息卡片）

发送飞书 Interactive Card，包含：
- 热量进度条
- 蛋白质状态（正常/⚠️偏低/⚠️超标）
- 训练动作列表
- 体重及趋势
- 个性化建议
- "查看数据看板"按钮（跳转浏览器）
