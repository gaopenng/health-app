# OpenClaw 接入排障记录

本文整理了 `health-app` 在接入 OpenClaw、飞书、Telegram、`health-agent` 和 Cloudflare Pages 过程中实际遇到的问题、原因和处理方式，便于后续复用。

## 1. Gateway 已加载但实际没起来

### 现象

- `openclaw gateway status` 显示 `Service: LaunchAgent (loaded)`
- 但同时显示：
  - `Runtime: stopped`
  - `RPC probe: failed`
  - `Service is loaded but not running (likely exited immediately)`

### 原因

- 本机 OpenClaw 版本过旧，仍在跑 `2026.3.12`
- `~/.openclaw/openclaw.json` 已被新版本 `2026.3.24` 写过
- 安装的 `openclaw-lark` 插件版本更高，依赖了旧版本 OpenClaw 不存在的模块
- LaunchAgent 仍指向旧入口 `dist/entry.js`

### 解决方案

1. 升级 OpenClaw 到与配置兼容的版本
2. 更新 `~/Library/LaunchAgents/ai.openclaw.gateway.plist`
3. 将服务入口改到新版 `dist/index.js`
4. 重启 LaunchAgent 和 gateway

### 验收标准

`openclaw gateway status` 至少应看到：

- `Runtime: running`
- `RPC probe: ok`
- `Listening: 127.0.0.1:18789`

## 2. Feishu 渠道插件重复注册

### 现象

- gateway 启动时报：
  - `channel already registered: feishu`

### 原因

- 新版 OpenClaw 已内置 `feishu`
- 本机仍保留外置 `openclaw-lark` 渠道插件
- 两者同时注册 `feishu`，导致冲突

### 解决方案

- 回到内置 `feishu` 渠道
- 从 `plugins` 配置中移除 `openclaw-lark` 的实际生效路径
- 保留 `telegram`、`feishu` 作为显式允许插件

## 3. 新建的 Feishu bot 不回消息

### 现象

- `doctor` 报：
  - `API error: app do not have bot`

### 原因

- 飞书应用虽已创建并填入 `appId/appSecret`
- 但飞书开放平台里没有启用 `Bot` 能力

### 解决方案

在飞书开放平台为该应用补齐：

1. 启用 `Bot`
2. 订阅 `im.message.receive_v1`
3. 选择长连接 `WebSocket`
4. 发布应用
5. 将 bot 拉入目标群

## 4. 飞书双 bot 同群需要两个独立应用

### 现象

- 希望在同一个飞书群里同时 `@main` 和 `@health-agent`

### 原因

- 一个飞书应用只对应一个 bot 身份
- 单账号无法在同一个群里呈现两个独立可 @ 的机器人

### 解决方案

必须准备两个独立飞书应用：

- `main` 对应飞书应用 A
- `health-agent` 对应飞书应用 B

并在 `openclaw.json` 中按 `accountId` 路由：

```json
{
  "bindings": [
    { "type": "route", "agentId": "main", "match": { "channel": "feishu", "accountId": "main" } },
    { "type": "route", "agentId": "health-agent", "match": { "channel": "feishu", "accountId": "default" } }
  ]
}
```

## 5. Feishu 群消息能正常收发，但 `directory groups list` 返回空

### 现象

- `openclaw directory groups list --channel feishu --json` 返回 `[]`
- 但实际群里 `@bot` 后消息能收到，也能回

### 原因

- 目录枚举结果不一定等于运行时真实收发状态
- 这类问题不能只看目录 API，必须看 gateway 日志

### 解决方案

以运行时日志为准进行验收，重点看：

- 收到入站群消息
- 路由到正确的 agent session
- `dispatch complete`

## 6. 餐食图片被点评，但没有记热量

### 现象

- 用户发餐食图后，`health-agent` 回复的是菜品点评、健康度、减脂建议
- 没有写入饮食记录文件

### 原因

- `agent/AGENTS.md` 对“图片必须优先落库”约束不够强
- `log-diet` skill 也没有把“先记录、后建议”写死

### 解决方案

强化两层规则：

1. 只要是餐食图片，默认目标必须是记录饮食
2. 回复顺序必须是：
   - 已记录
   - 本餐热量
   - 今日累计
   - 最后才允许补充 1 到 2 句建议

## 7. `health-agent` 回复“您尚未注册，请联系管理员获取邀请码”

### 现象

- Telegram 私聊已打通
- 但 `health-agent` 只回复：
  - `您尚未注册，请联系管理员获取邀请码`

### 原因

- `agent/AGENTS.md` 明确要求所有消息先检查 `~/.health/users.json`
- 当前 `sender_id` 不在用户列表中

### 解决方案

有两种方式：

1. 正常流程
   - 生成邀请码
   - 用户发送 `加入 {CODE}`
2. 本地直接补注册
   - 在 `~/.health/users.json` 新增用户
   - 创建 `~/.health/{sender_id}/profile.json`

### 备注

群聊场景下，`health-agent` 用的是“@机器人的那个人”的 `sender_id`，不是群 ID。

## 8. Telegram 第二个 bot token 配对后仍然不回私聊

### 现象

- `main` bot 私聊正常
- `health` bot 能出站发消息，但用户回它时没有任何反应

### 原因

从 OpenClaw 本地源码确认：

- Telegram 多账号设计是支持的
- 但 `telegram` 的 pairing 通知路径里使用了默认 token，没有显式传入 `accountId`
- 第二账号的 DM/pairing 链路存在实现缺陷嫌疑

### 解决方案

不要让第二账号继续走 `pairing`，改为直接白名单：

```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "health": {
          "dmPolicy": "allowlist",
          "allowFrom": ["8029666915"]
        }
      }
    }
  }
}
```

这样可以绕开第二账号的 pairing 路径。

## 9. Telegram 双 bot 同实例是否真的支持

### 结论

支持，且源码里是明确设计支持的。

### 关键依据

- Telegram 配置类型支持多账号：
  - `accounts?: Record<string, TelegramAccountConfig>`
  - `defaultAccount?: string`
- gateway 启动时按账号逐个 `startAccount`
- Telegram session route 会把 `accountId` 带入 session key
- route binding 也可以按 `channel + accountId` 分流到不同 agent

### 实际配置方式

```json
{
  "channels": {
    "telegram": {
      "defaultAccount": "main",
      "accounts": {
        "main": { "botToken": "..." },
        "health": { "botToken": "..." }
      }
    }
  },
  "bindings": [
    { "type": "route", "agentId": "main", "match": { "channel": "telegram", "accountId": "main" } },
    { "type": "route", "agentId": "health-agent", "match": { "channel": "telegram", "accountId": "health" } }
  ]
}
```

## 10. Telegram 群里 `@bot` 没反应，但私聊正常

### 现象

- 两个 Telegram bot 私聊都能通
- 在群 `管家们` 中 `@godpennnclaw_bot` 和 `@godpennnclaw_health_bot` 都没有反应
- gateway 日志里也没有新的 Telegram 群入站

### 原因

这次是多个因素叠加：

1. 目标群已经从旧 supergroup id 迁移：
   - `-5298972899 -> -1003617551803`
2. OpenClaw 日志里已有迁移记录，但同时提示：
   - `No config found for old group ID ...`
3. 两个 Telegram bot 虽然都在群里，且都具备读群消息能力
4. 但当前群没有显式写入两个账号的 `groups` 配置，迁移后群路由状态不稳定

### 解决方案

为两个 Telegram 账号显式补上当前群 id：

```json
{
  "channels": {
    "telegram": {
      "accounts": {
        "main": {
          "groups": {
            "-1003617551803": { "enabled": true, "requireMention": true }
          }
        },
        "health": {
          "groups": {
            "-1003617551803": { "enabled": true, "requireMention": true }
          }
        }
      }
    }
  }
}
```

然后重启 gateway。

### 验收结果

补上 `groups` 配置后，两个 bot 都恢复了群聊响应：

- `@godpennnclaw_bot` -> `main`
- `@godpennnclaw_health_bot` -> `health-agent`

## 11. Telegram 群排障时的有效检查顺序

这套顺序在本项目里验证过，效率最高：

1. 检查 `openclaw gateway status`
2. 检查 bot 是否真的在群里
3. 用 Telegram 官方接口检查：
   - `getMe`
   - `getChatMember`
   - `getChat`
   - `getWebhookInfo`
4. 看 gateway 日志是否出现 Telegram 入站
5. 看 `raw-stream.jsonl` 是否产生回复
6. 若群刚迁移过，显式补 `channels.telegram.accounts.<id>.groups.<chat_id>`

## 12. Cloudflare 部署误判为 Hugo

### 现象

- Cloudflare 构建日志里自动探测出：
  - `Build Command: npx hugo`
  - `Output Directory: public`

### 原因

- 线上拉到的仓库缺少最新的 `wrangler.jsonc`
- Cloudflare 进入自动推断流程，误判为静态 Hugo 项目

### 解决方案

1. 确保最新提交已 push
2. 仓库根目录保留 `wrangler.jsonc`
3. 新版部署表单使用：
   - `Build command`: 留空
   - `Deploy command`: `npx wrangler deploy`

## 当前推荐配置结论

### Feishu

- 每个独立 bot 身份使用一个独立飞书应用
- 按 `accountId` 路由到不同 agent

### Telegram

- 单实例可运行双 bot
- `main` 可继续使用默认 `pairing`
- 第二账号若遇到 pairing 问题，优先改为 `allowlist`
- 群聊建议显式写入 `groups.{chat_id}`

### health-agent

- 所有消息先过 `users.json` 注册检查
- 图片饮食必须先落库，再建议

