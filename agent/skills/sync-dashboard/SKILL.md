---
name: sync-dashboard
description: Aggregate user health data into dashboard JSON files and trigger a debounced publish flow after logging changes. Use when diet, workout, or weight updates should refresh dashboard data for one or more active users.
---

# sync-dashboard

在健康数据发生变化后刷新 dashboard 数据。

## 工作流程

1. 先检查当前是否已经存在待执行的 dashboard 同步任务。
2. 如果没有待执行任务，则安排一个带防抖窗口的发布任务。
3. 如果已经有待执行任务且尚未到达计划时间，则直接返回，不再重复触发发布。
4. 当发布窗口开启时：
   - 从 `users.json` 读取活跃用户
   - 聚合每个活跃用户的 dashboard 数据
   - 按用户 token 写出对应的 dashboard JSON 文件
   - 在合适时调用 `scripts/build-dashboard-data.js` 做确定性聚合
   - 触发 dashboard 发布流程
5. 发布成功后清除待同步状态。

## 输出要求

- 在防抖窗口内避免重复发布。
- 基于最新健康数据生成 dashboard JSON。
- 尽可能保证发布步骤具备幂等性。

## 参考资料

- 阅读 `references/dashboard-schema.md`，了解输出结构。
- 阅读 `references/runtime-notes.md`，了解防抖和发布环境要求。

## 内置脚本

- `scripts/build-dashboard-data.js`：为活跃用户或指定目标生成 dashboard JSON 文件。
- `scripts/health-data-utils.js`：构建脚本使用的共享健康数据工具。
