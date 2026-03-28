---
name: weekly-review
description: Generate a per-user weekly health review from diet, workout, weight, and profile data, then prepare a push-ready weekly summary with concrete next-step suggestions and a dashboard link. Use when an agent needs to produce or deliver a weekly health review, including scheduled weekly review workflows.
---

# weekly-review

为单个用户生成每周健康回顾。

## 必需输入

- `user_sender_id`：用于投递消息的渠道发送者 ID
- `user_id`：稳定的内部用户 ID
- `data_dir`：用户数据目录

## 工作流程

1. 读取本周从周一到周日的文件：
   - `diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
   - `workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
   - 同一周内最近一次体重记录
2. 读取 `profile.json` 获取周目标和日目标。
3. 计算以下指标：
   - 热量总量与平均值
   - 蛋白质、碳水、脂肪的平均值
   - 训练天数相对目标的完成情况
   - 从本周第一条可用体重到最新体重的变化
4. 生成 2 到 3 条下周可执行的具体建议。
5. 根据 `daily_report_target` 解析投递目标。
6. 使用 `dashboard_token` 拼接 dashboard 链接。
7. 返回可直接推送的周回顾内容。

## 输出要求

- 必须包含本周饮食摘要。
- 必须包含训练频率和训练亮点。
- 必须包含体重趋势。
- 必须包含 2 到 3 条具体的下一步建议。
- 必须包含 dashboard 链接。

## 参考资料

- 阅读 `references/report-format.md`，了解响应结构。
- 阅读 `references/data-contract.md`，了解文件与字段约定。
