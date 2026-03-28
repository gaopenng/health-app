---
name: log-diet
description: Record diet entries from meal text or food images, estimate calories and macros, write the daily diet record, and reply with updated daily totals. Use for meal logging in chat, including image-based food intake capture.
---

# log-diet

将一餐或一次加餐记录到用户当天的饮食数据中。

## 必需输入

- `user_sender_id`
- `user_id`
- `user_channel`
- `data_dir`
- `content`：可能包含文字、图片，或同时包含两者；至少要有一种有效内容
- `reply_target`
- `sender_name`
- `meal_time`：当用户明确提供了进食时间时传入

## 工作流程

1. 先解析输入中的所有可用信息源。
   - 如果有图片，先从图片中识别食物并估算分量。
   - 如果有文字，用文字补充、修正或约束图片识别结果，例如菜名、做法、分量、是否吃完、具体时间。
   - 如果同时有文字和图片，不要把两者视为互斥输入，必须合并判断。
2. 估算本次进食的：
   - 热量
   - 蛋白质
   - 碳水
   - 脂肪
3. 根据用户描述或解析出的本地时间确定 `meal_type`。
   - `meal_type` 只允许 `breakfast`、`lunch`、`dinner`、`snack`。
4. 确定目标文件绝对路径：`{data_dir}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`。
5. 按 `references/diet-file-format.md` 的规范直接写入当天饮食文件。
   - 如果当天文件不存在，创建新的标准结构。
   - 如果当天文件已存在，先读取现有内容，再把本次进食合并进对应餐次。
   - 同一天同一 `meal_type` 只能保留一个 meal；如果命中已有餐次，向该餐次追加 `items`，并把该餐次的营养值累加，而不是创建重复 meal。
   - 只需要写 item 级别的营养估算，不需要计算每餐 `meal_*` 或当天顶层 `total_*`。
   - 不要把 `reply_target`、`user_id` 之类路由字段写入 diet 文件。
6. 写入后调用 `scripts/validate-diet-day.js` 校验当天文件，并获取汇总结果。
   - 传入 `data_dir`、`date`，以及本次写入对应的 `meal_type`。
   - 由该脚本根据 `items[*].calories_est / protein_est_g / carb_est_g / fat_est_g` 计算并回写每餐 `meal_*` 与当天 `total_*`。
   - 回复中的累计值全部使用校验脚本返回的 `daily_totals`。
7. 如果校验失败，直接修正 JSON 文件后重试，直到校验通过。
8. 读取 `profile.json` 获取每日目标。
   - 至少使用这些目标字段来生成回复中的累计进度展示：`daily_calorie_target`、`protein_target_g`、`carb_target_g`、`fat_target_g`。
9. 基于用户目标与当天累计饮食情况生成简短建议。
   - 建议是必需输出，不能省略。
   - 建议必须结合用户目标字段和当天累计完成度来写，不能给与数据无关的泛泛建议。
   - 建议应优先指出下一餐或今天剩余时段更适合补什么、控什么，保持简短且可执行。
10. 解析用户的 dashboard 链接。
    - 从用户记录中读取 `dashboard_token`。
    - 与项目配置或运行时上下文中的 `dashboard_public_base_url` 组合成完整链接。
11. 记录成功后立即调用 `../sync-dashboard/scripts/publish-dashboard.js` 刷新并发布 dashboard 数据。
    - 传入 `{health_data_dir}`、`{dashboard_data_dir}`、`{repo_root}`。
    - 只提交 dashboard 聚合文件，不要把其他工作区改动一起提交。
12. 在可用时返回带 dashboard 链接的确认消息。

## 输出要求

- 开头先明确说明这餐已经记录成功。
- 必须包含本次进食的估算结果。
- 必须包含当天累计的热量、蛋白质、碳水和脂肪。
- 热量、蛋白质、碳水、脂肪这四项累计值都必须带进度条，这是严格约束，不能只给数字。
- 这四项都必须按“当前值 / 目标值 + 进度条 + 百分比”的形式展示；不能只给热量加进度条。
- 必须给出建议，这是严格约束，不能省略。
- 建议必须明确基于用户目标和当天饮食情况，至少体现一条和当前累计差距直接相关的判断或下一步行动。
- 只要 `dashboard_token` 和 `dashboard_public_base_url` 可用，就必须附带 dashboard 链接。
- 把 dashboard 链接视为正常确认消息的一部分，而不是可有可无的装饰。
- 如果输入中包含图片，不要只停留在图片点评，必须先完成记录。
- 建议应保持简短并放在次要位置，但仍然必须出现。

## 错误处理

- 如果图片中没有可识别的食物，但文字已经足够完成记录，直接按文字继续。
- 如果图片和文字加起来仍不足以可靠判断吃了什么，要求用户补充文字描述。
- 如果校验失败，修复写入后的 JSON 文件并重跑校验脚本。
- 如果写入仍然失败，返回简短的稍后重试提示，并记录失败信息。

## 参考资料

- 阅读 `references/diet-file-format.md`，了解持久化文件结构。
- 阅读 `references/validation-script.md`，了解校验汇总脚本的调用方式与返回字段。
- 阅读 `references/reply-format.md`，了解确认消息示例。
- 阅读 `references/dashboard-link.md`，了解 dashboard URL 的拼接方式。

## 内置脚本

- `scripts/validate-diet-day.js`：校验当天饮食文件结构，并返回 `daily_totals` 与目标餐次汇总。
- `scripts/health-data-utils.js`：脚本依赖的共享文件与数据标准化工具。
