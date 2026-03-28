# health-app

AI 原生健康管理助手，通过 Telegram / 飞书对话记录饮食、训练、体重，每日自动推送健康日报，并提供专属数据看板。

## 架构

```
对话渠道（Telegram / 飞书）
    ↓ OpenClaw bindings 路由
health-agent（AGENTS.md）
    ↓ 调用 Skills
本地文件系统（~/.health/）
    ↓ 用户请求查看看板时 build dashboard data + git push
Cloudflare Pages（dashboard/）
```

## 目录结构

```
health-app/
├── config.json                # 配置文件（含默认值）
├── config.local.example.json  # 本地配置模板（不进 git）
├── setup.sh                   # 初始化数据目录并生成运行时配置
├── mock-data/
│   ├── health/                # 仓库内置 mock 原始数据
│   └── scripts/               # mock 数据生成脚本
├── agent/
│   ├── AGENTS.md              # Agent 系统提示词
│   ├── settings.json          # OpenClaw bindings 示例配置
│   └── skills/                # 7 个 Skill
│       ├── log-diet/
│       ├── log-workout/
│       ├── log-weight/
│       ├── daily-report/
│       ├── weekly-review/
│       ├── sync-dashboard/
│       └── user-manager/
└── dashboard/                 # Cloudflare Pages 静态站
    ├── index.html
    ├── assets/
    ├── scripts/               # 本地后台调试脚本
    └── data/                  # 聚合数据（由 sync-dashboard 写入并发布）
```

## 快速部署

### 1. fork 并绑定 Cloudflare Pages

fork 本仓库到自己的 GitHub，在 Cloudflare Pages 绑定 fork 后的仓库。

推荐配置：

| 配置项 | 值 |
|------|------|
| Framework preset | `None` |
| Production branch | `main` |
| Build command | 留空 |
| Build output directory | `dashboard` |
| Root directory | 留空 |

说明：
- `dashboard/` 目录本身就是可直接发布的静态站输出目录
- `/admin` 是本地调试入口，生产 Pages 站点会通过 `_redirects` 自动回到首页
- `dashboard/_headers` 已内置 Pages 响应头规则，`dashboard/_redirects` 已内置 `/admin` 路由处理

如果 Cloudflare Dashboard 显示的是新版统一部署表单，页面上会出现：
- `Build command`
- `Deploy command`

这时也可以直接部署。本仓库已经包含 [wrangler.jsonc](/Users/akihi/code/health-app/wrangler.jsonc)，用于告诉 Cloudflare 把 `dashboard/` 作为静态资源目录。

新版表单建议这样填：

| 配置项 | 值 |
|------|------|
| Project name | `health-app` |
| Build command | 留空 |
| Deploy command | `npx wrangler deploy` |

说明：
- 这条部署链路会走 Cloudflare 当前的 Workers / Pages 统一部署流程
- `wrangler.jsonc` 中已固定 `assets.directory = "./dashboard"`
- `_headers` 和 `_redirects` 仍然会随 `dashboard/` 一起生效

### 2. 填写本地配置

```bash
cp config.local.example.json config.local.json
```

如果当前机器的 OpenClaw 已经配置好了 Telegram / 飞书渠道，`config.local.json` 至少填写这两个字段即可：

```json
{
  "dashboard_public_base_url": "https://health-app.example.workers.dev",
  "admin": {
    "user_id": "",
    "channel": "telegram",
    "username": "你的用户名",
    "sender_id": "你的飞书或 Telegram 用户 ID",
    "name": "你的显示名"
  }
}
```

说明：
- `admin.user_id` 可留空；首次初始化时会自动生成 UUID v4
- `admin.username` 是用户自己决定的称呼，建议稳定、可读，例如 `akihi`
- `admin.channel + admin.sender_id` 表示管理员的首个渠道身份
- 后续新增其他渠道身份时，应追加到 `users.json` 的 `identities[]`，而不是新建第二个用户目录

只有在这台机器尚未配置飞书渠道时，才需要额外补 `feishu.app_id`、`feishu.app_secret` 等字段。

### 3. 初始化数据目录与运行时配置

```bash
chmod +x setup.sh
./setup.sh
```

脚本会完成这些事情：

- 初始化 `health_data_dir`（默认 `~/.health`）
- 写入 `users.json`、`invites.json`、管理员 `profile.json`
- 生成运行时配置 `agent/.openclaw/health-config.json`（git ignore）

### 饮食记录格式与校验

饮食数据现在按标准结构直接写入绝对路径 `{data_dir}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`，写入完成后再执行校验脚本获取汇总结果。
模型只需要写 `items` 级别的营养估算；每餐 `meal_*` 和当天顶层 `total_*` 由校验脚本计算并回写。

标准 meal 结构示例：

```json
{
  "date": "2026-03-28",
  "meals": [
    {
      "id": "meal_001",
      "meal_type": "breakfast",
      "time": "09:30",
      "description": "双蛋肠粉",
      "source": "text",
      "items": [
        {
          "name": "双蛋肠粉",
          "amount": "1份",
          "calories_est": 450,
          "protein_est_g": 19,
          "carb_est_g": 42,
          "fat_est_g": 22
        }
      ],
      "channel": "telegram",
      "sender_id": "8029666915",
      "sender_name": "yuyan Peng"
    }
  ]
}
```

校验命令：

```bash
node agent/skills/log-diet/scripts/validate-diet-day.js \
  --data-dir ~/.health/<user_id> \
  --date 2026-03-28 \
  --meal-type breakfast
```

规则：

- 同一天同一 `meal_type` 只能保留一个 meal。
- `meal_type` 只允许 `breakfast`、`lunch`、`dinner`、`snack`。
- `snack` 不再区分上午、下午、晚上。
- `validate-diet-day.js` 会根据 `items[*]` 自动计算并回写 `meal_*` 与 `total_*`。
- 回复里的累计营养值应使用校验脚本返回的 `daily_totals`。

### 4. 安装到 OpenClaw

```bash
openclaw agents add health-agent --workspace "$(pwd)/agent" --non-interactive
openclaw agents bind --agent health-agent --bind telegram --bind feishu
openclaw gateway restart
```

说明：

- `health-agent` 使用仓库内的 `agent/` 目录作为工作区
- 绑定完成后，所有 Telegram / 飞书消息都会优先路由到 `health-agent`
- `agent/settings.json` 保留为示例配置；实际推荐直接使用 `openclaw agents bind`

### 5. 验证

本机验证：

```bash
openclaw agents list
openclaw agents bindings
```

飞书群组验证：

1. 把机器人拉进目标飞书群
2. 在群里 `@机器人`
3. 发送：`记录体重 75kg`

预期结果：机器人在群里公开回复一条体重记录确认消息。

## 配置说明

`config.json` 含所有配置的默认值，**只需在 `config.local.json` 中覆盖差异项**：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `health_data_dir` | `~/.health` | 用户原始数据目录（不进 git） |
| `dashboard_data_dir` | `./dashboard/data` | 看板聚合数据目录 |
| `dashboard_public_base_url` | 空（建议填） | 线上看板域名，供机器人在渠道内直接返回专属链接 |
| `admin.user_id` | 空（可选） | 内部稳定用户 ID；为空时初始化脚本自动生成 UUID v4 |
| `admin.channel` | 空（建议填） | 管理员当前主渠道，如 `telegram` / `feishu` |
| `admin.username` | 空（必填） | 用户自己定义的稳定用户名 |
| `admin.sender_id` | 空（必填） | 管理员的渠道用户 ID |
| `admin.name` | 空（可选） | 管理员显示名；为空时回退为 `admin.username` |
| `feishu.*` | 空（可选） | 仅在当前机器尚未配置飞书渠道时填写 |

## 用户模型

`health-app` 现在区分两层身份：

- `user_id`：内部唯一用户 ID，也是数据目录名
- `username`：用户自己决定的可读名称
- `identities[]`：渠道身份映射，例如 `telegram:8029666915`、`feishu:ou_xxx`

示例：

```json
{
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "akihi",
  "name": "Akihi",
  "identities": [
    { "channel": "telegram", "sender_id": "8029666915" },
    { "channel": "feishu", "sender_id": "ou_7c9ad28215c2e53956ba5c0ac5432926" }
  ]
}
```

含义是：
- 不同渠道来的消息先匹配 `identities[]`
- 命中后统一写入 `~/.health/{user_id}/`
- 同一个人不再因为换渠道而分裂成多份数据

如果你要把新渠道身份手动绑定到已有用户，可以运行：

```bash
node agent/skills/user-manager/scripts/link-user-identity.js \
  --user-id 550e8400-e29b-41d4-a716-446655440000 \
  --channel telegram \
  --sender-id 8029666915
```

这条命令只会更新 `users.json` 的身份映射，不会自动迁移旧目录里的历史文件。

## 渠道内返回看板

如果你已经配置了 `dashboard_public_base_url`，用户在 Telegram / 飞书里发送：

- `看板`
- `查看数据看板`
- `我的数据`

`health-agent` 应直接返回：

```text
https://your-domain/?token=<dashboard_token>
```

其中 `<dashboard_token>` 从 `users.json` 读取，域名来自 `dashboard_public_base_url`。

## OpenClaw 排障

如果你在接入 OpenClaw、飞书、Telegram、双 bot 路由或 Cloudflare 部署时遇到问题，可以直接参考：

- [openclaw/TROUBLESHOOTING.md](/Users/akihi/code/health-app/openclaw/TROUBLESHOOTING.md)

## 后台调试服务

如果你要的是“后台调试页”，直接查看 `~/.health` 原始文件，而不是看聚合 JSON，可以启动本地 Node 服务：

```bash
node dashboard/scripts/admin-dashboard-server.js
```

默认会监听：

```
http://127.0.0.1:4180/admin/
```

这个后台页会实时读取：
- `~/.health/users.json`
- `~/.health/{user_id}/profile.json`
- `~/.health/{user_id}/diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
- `~/.health/{user_id}/weight/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
- `~/.health/{user_id}/workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`

适合排查“消息已经记录，但用户看板还没刷新”这类问题。

## Mock 数据

如果你要给后台调试看板演示两位用户近 30 天的数据，可以先生成仓库内置的 mock 原始数据：

```bash
node mock-data/scripts/generate-mock-health-data.js
```

默认会写到：

```
./mock-data/health
```

生成内容包括：
- 2 个活跃用户
- 每人 30 天体重记录
- 每人 30 天饮食记录
- 每人约 3 周训练记录
- 文件按 `类型 / 年 / 月 / 日文件` 组织

如果要让后台页直接读取这批 mock 数据，而不是读取真实 `~/.health`，可以这样启动：

```bash
HEALTH_DATA_DIR="$(pwd)/mock-data/health" PORT=4181 node dashboard/scripts/admin-dashboard-server.js
```

浏览器地址：

```
http://127.0.0.1:4181/admin/
```

## 本地看板预览

如果你想先在本机查看后台看板，而不依赖 Cloudflare Pages，可以先刷新聚合数据，再启动一个静态文件服务：

```bash
node agent/skills/sync-dashboard/scripts/build-dashboard-data.js
python3 -m http.server 4173 --directory dashboard
```

第一条命令会从 `~/.health/` 聚合活跃用户数据，写入 `dashboard/data/{dashboard_token}.json`。

启动后，在浏览器打开：

```
http://127.0.0.1:4173/?token=<dashboard_token>
```

其中 `dashboard_token` 可在 `~/.health/users.json` 中查看。

如果只想刷新数据、不启动本地服务：

```bash
node agent/skills/sync-dashboard/scripts/build-dashboard-data.js
```

如果要在返回用户看板链接前刷新线上看板：

```bash
node agent/skills/sync-dashboard/scripts/publish-dashboard.js
```

该脚本会重新生成 `dashboard/data` 下的聚合 JSON，只提交这部分文件，然后 push 当前分支。推荐只在用户明确请求查看看板时调用。

## 数据备份

用户原始数据存储在 `health_data_dir`（默认 `~/.health`），**不进 git**。

- macOS：将 `health_data_dir` 配置为 iCloud Drive 子目录，自动同步
- Linux：定时 rsync 到私有 NAS 或加密云存储
