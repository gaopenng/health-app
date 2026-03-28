---
name: daily-report
description: Generate a per-user daily health summary from diet, workout, weight, and profile data, then prepare a push-ready report with an actionable suggestion and dashboard link. Use when an agent needs to produce or deliver a user's daily health report, including scheduled daily report workflows.
---

# daily-report

为单个用户生成每日报告。

## 必需输入

- `user_sender_id`：用于投递消息的渠道发送者 ID
- `user_id`：稳定的内部用户 ID
- `data_dir`：用户数据目录

## 工作流程

1. 从 `diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json` 读取当天饮食记录。
2. 从 `workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json` 读取当天训练记录。
   - 如果文件不存在，则视为当天未训练。
3. 在 `weight/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json` 中向前最多回溯 7 天，找到最近一次体重记录。
4. 读取 `profile.json` 获取目标配置。
5. 汇总以下内容：
   - 热量相对目标的完成情况
   - 蛋白质相对目标的达成情况
   - 训练亮点，或明确说明当天未训练
   - 最新体重，以及在存在历史数据时的近期变化
6. 生成且只生成一条简短、具体、个性化的建议。
   - 优先关注蛋白质缺口、热量超标、训练频率或体重趋势。
7. 根据用户的 `daily_report_target` 解析投递目标。
   - 支持 `{channel}:group:{groupId}` 和 `{channel}:dm:{senderId}`。
   - 也兼容历史格式 `group:{groupId}` 和 `dm:{senderId}`。
8. 使用用户记录中的 `dashboard_token` 拼接用户的 dashboard 链接。
9. 按正确的渠道格式返回可直接推送的日报内容。

## 输出要求

- 必须包含饮食摘要。
- 必须包含训练摘要。
- 必须包含体重摘要。
- 必须包含一条可执行建议。
- 必须包含 dashboard 链接。
- 最终消息要简洁，并且可直接发送。

## 参考资料

- 阅读 `references/report-format.md`，了解不同渠道的输出结构。
- 阅读 `references/data-contract.md`，了解文件约定和字段规范。
