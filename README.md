# health-app

AI 原生健康管理助手，通过 Telegram / 飞书对话记录饮食、训练、体重，每日自动推送健康日报，并提供专属数据看板。

## 架构

```
对话渠道（Telegram / 飞书）
    ↓ OpenClaw bindings 路由
health-agent（AGENTS.md）
    ↓ 调用 Skills
本地文件系统（~/.health/）
    ↓ sync-dashboard git push
Cloudflare Pages（dashboard/）
```

## 目录结构

```
health-app/
├── config.json                # 配置文件（含默认值）
├── config.local.example.json  # 本地配置模板（不进 git）
├── setup.sh                   # 初始化数据目录并生成运行时配置
├── scripts/                   # 本地聚合与预览脚本
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
    └── data/                  # 聚合数据（由 sync-dashboard 写入）
```

## 快速部署

### 1. fork 并绑定 Cloudflare Pages

fork 本仓库到自己的 GitHub，在 Cloudflare Pages 绑定 fork 后的仓库，**Root directory 设为 `dashboard/`**。

### 2. 填写本地配置

```bash
cp config.local.example.json config.local.json
```

如果当前机器的 OpenClaw 已经配置好了 Telegram / 飞书渠道，`config.local.json` 至少填写这两个字段即可：

```json
{
  "admin": {
    "sender_id": "你的飞书或 Telegram 用户 ID",
    "name": "你的显示名"
  }
}
```

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
| `admin.sender_id` | 空（必填） | 管理员的渠道用户 ID |
| `admin.name` | 空（必填） | 管理员显示名 |
| `feishu.*` | 空（可选） | 仅在当前机器尚未配置飞书渠道时填写 |

## 本地看板预览

如果你想先在本机查看后台看板，而不依赖 Cloudflare Pages，可以直接：

```bash
./scripts/preview-dashboard.sh
```

脚本会从 `~/.health/` 聚合活跃用户数据，写入 `dashboard/data/{dashboard_token}.json`。

启动后，在浏览器打开：

```
http://127.0.0.1:4173/?token=<dashboard_token>
```

其中 `dashboard_token` 可在 `~/.health/users.json` 中查看。

如果只想刷新数据、不启动本地服务：

```bash
node scripts/build-dashboard-data.js
```

## 数据备份

用户原始数据存储在 `health_data_dir`（默认 `~/.health`），**不进 git**。

- macOS：将 `health_data_dir` 配置为 iCloud Drive 子目录，自动同步
- Linux：定时 rsync 到私有 NAS 或加密云存储
