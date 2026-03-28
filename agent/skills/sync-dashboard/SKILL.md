---
name: sync-dashboard
description: Aggregate user health data into dashboard JSON files and publish them on demand before returning a dashboard link. Use when a user explicitly asks to open or view the latest dashboard.
---

# sync-dashboard

当用户明确要求查看看板时，刷新 dashboard 数据，并通过 git push 触发 Cloudflare Pages 部署。

## 工作流程

1. 仅在用户明确要求查看看板时执行，不要在饮食、体重、训练记录成功后自动执行。
2. 读取运行时配置中的 `{health_data_dir}`、`{dashboard_data_dir}` 与 `{repo_root}`。
3. 调用 `scripts/publish-dashboard.js`。
4. 该脚本会：
   - 从 `users.json` 读取活跃用户
   - 聚合每个活跃用户的 dashboard 数据
   - 按用户 token 写出对应的 dashboard JSON 文件
   - 只提交 `dashboard_data_dir` 下的聚合结果
   - push 当前分支，触发 Cloudflare Pages 部署
5. 若本次聚合后 `dashboard_data_dir` 没有变化，则不重复 commit / push。

## 输出要求

- 基于最新健康数据生成 dashboard JSON。
- 只在显式看板请求时触发发布。
- 只提交 dashboard 聚合数据，不夹带其他工作区修改。
- 若聚合结果未变化，不重复触发部署。

## 参考资料

- 阅读 `references/dashboard-schema.md`，了解输出结构。
- 阅读 `references/runtime-notes.md`，了解即时发布的环境要求。

## 内置脚本

- `scripts/build-dashboard-data.js`：为活跃用户或指定目标生成 dashboard JSON 文件。
- `scripts/publish-dashboard.js`：构建 dashboard JSON，并提交、推送聚合结果。
- `scripts/health-data-utils.js`：构建脚本使用的共享健康数据工具。
