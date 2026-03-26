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
├── config.local.example.json  # 本地配置模板
├── setup.sh                   # 一键初始化脚本
├── agent/
│   ├── AGENTS.md              # Agent 系统提示词
│   ├── settings.json          # OpenClaw bindings 配置
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
# 编辑 config.local.json，填入 admin.sender_id 和 admin.name
# 如使用飞书渠道，同时填入飞书配置
```

### 3. 一键初始化

```bash
chmod +x setup.sh
./setup.sh
```

### 4. 注册到 OpenClaw

- 将 `agent/AGENTS.md` 和 `agent/skills/` 注册到 OpenClaw
- 将 `agent/settings.json` 合并到 OpenClaw 配置
- 重启 OpenClaw

### 5. 验证

向 Bot 发送任意消息，应收到"您尚未注册"的提示（说明路由和鉴权正常）。

## 配置说明

`config.json` 含所有配置的默认值，**只需在 `config.local.json` 中覆盖差异项**：

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `health_data_dir` | `~/.health` | 用户原始数据目录（不进 git） |
| `dashboard_data_dir` | `./dashboard/data` | 看板聚合数据目录 |
| `admin.sender_id` | 空（必填） | 管理员的渠道用户 ID |
| `admin.name` | 空（必填） | 管理员显示名 |
| `feishu.*` | 空（可选） | 不使用飞书可留空 |

## 数据备份

用户原始数据存储在 `health_data_dir`（默认 `~/.health`），**不进 git**。

- macOS：将 `health_data_dir` 配置为 iCloud Drive 子目录，自动同步
- Linux：定时 rsync 到私有 NAS 或加密云存储
