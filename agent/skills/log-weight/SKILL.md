---
name: log-weight
description: Extract body weight values from natural-language chat messages, normalize units, write the daily weight record, and reply with change versus the latest prior record. Use for body weight logging in chat.
---

# log-weight

记录一条体重数据。

## 必需输入

- `user_sender_id`
- `user_id`
- `user_channel`
- `data_dir`
- `content`
- `reply_target`
- `sender_name`

## 工作流程

1. 从用户消息中提取体重数值。
2. 统一换算为千克。
   - `斤`：除以 2
   - `lb` 或 `lbs`：乘以 `0.453592`
   - `kg`：直接使用
3. 构造传给 `scripts/append-weight-entry.js` 的合法 payload。
4. 调用 `scripts/append-weight-entry.js` 写入当天体重，并获取最近一次历史记录。
5. 解析用户的 dashboard 链接。
   - 从用户记录中读取 `dashboard_token`。
   - 与项目配置或运行时上下文中的 `dashboard_public_base_url` 组合成完整链接。
6. 标准体重记录流程中，不要刷新或发布 Cloudflare dashboard。
7. 回复中包含本次记录的体重与最近历史记录相比的变化；若用户明确要求查看看板，再单独刷新并返回链接。

## 错误处理

- 如果无法可靠提取体重数值，要求用户重新发送并带上单位。
- 如果脚本校验失败，修正 payload 后重试。

## 输出要求

- 标准体重记录确认中不必附带 dashboard 链接。
- 若用户明确要求查看最新看板，再单独触发看板刷新并返回链接。

## 参考资料

- 阅读 `references/payload-schema.md`，了解脚本输入格式。
- 阅读 `references/weight-file-format.md`，了解持久化结构。
- 阅读 `references/reply-format.md`，了解确认消息格式。
- 阅读 `references/dashboard-link.md`，了解 dashboard URL 的拼接方式。

## 内置脚本

- `scripts/append-weight-entry.js`：校验 payload、写入每日体重记录，并返回与上一条记录的差值信息。
- `scripts/health-data-utils.js`：内置脚本使用的共享文件工具。
