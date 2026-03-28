---
name: log-workout
description: Parse workout messages into exercises, sets, reps, weights, or duration, append the daily workout record, and confirm the logged training summary. Use for strength or cardio workout logging from chat.
---

# log-workout

记录一次训练更新。

## 必需输入

- `user_sender_id`
- `user_id`
- `user_channel`
- `data_dir`
- `content`
- `reply_target`
- `sender_name`

## 工作流程

1. 将用户的训练描述解析为标准化的动作数据。
2. 对每个动作确定以下字段：
   - `name`
   - `category`
   - 如有力量训练数据，则提取组数、次数和重量
   - 如有有氧训练数据，则提取时长
3. 构造传给 `scripts/append-workout-entry.js` 的合法 payload。
4. 让脚本为力量动作计算 `total_volume_kg`，并把动作追加到当天训练文件中。
5. 回复简洁确认消息，包含已记录的训练摘要。

## 错误处理

- 如果训练消息无法稳定解析为可靠记录，要求用户用更清晰的结构重发。
- 如果脚本校验失败，修正 payload 后重试。

## 参考资料

- 阅读 `references/payload-schema.md`，了解脚本输入格式。
- 阅读 `references/parsing-examples.md`，了解标准化解析示例。
- 阅读 `references/workout-file-format.md`，了解持久化结构。
- 阅读 `references/reply-format.md`，了解确认消息格式。
## 内置脚本

- `scripts/append-workout-entry.js`：校验 payload、计算派生字段，并追加训练记录。
- `scripts/health-data-utils.js`：内置脚本使用的共享文件工具。
