---
name: user-manager
description: Manage user invitations, registration, identity mapping, and user listing for the health assistant. Use for admin invite generation, invite-code joins, username collection, new user creation, or listing users.
---

# user-manager

管理健康助手的用户数据。

## 意图路由

先确定要走哪一个子流程：

- 生成邀请码
- 使用邀请码注册用户
- 查询用户列表

## 工作流程

### 生成邀请码

1. 先校验操作者具有 `admin` 角色。
2. 生成 6 位邀请码，只使用大写字母和数字，并避开易混淆字符。
3. 将邀请码写入 `invites.json`，有效期为 7 天。
4. 返回邀请码及其使用说明。

### 用户注册

1. 读取 `invites.json` 并校验邀请码。
2. 如果邀请码无效或已过期，返回拒绝消息。
3. 如果邀请码有效但缺少用户名：
   - 询问用户希望如何称呼
   - 持久化待完成注册状态，至少包含 `code`、`channel` 和 `sender_id`
4. 收到用户名后：
   - 确保用户名非空且唯一
   - 生成 UUID v4 作为 `user_id`
   - 生成 UUID v4 作为 `dashboard_token`
   - 将用户记录追加到 `users.json`
   - 把当前身份加入 `identities[]`
   - 创建用户目录
   - 写入默认 `profile.json`
   - 将邀请码标记为已使用
5. 返回注册成功消息和 dashboard 链接。

### 查询用户列表

1. 先校验操作者具有 `admin` 角色。
2. 读取 `users.json`。
3. 返回格式化后的用户列表。

## 参考资料

- 阅读 `references/data-model.md`，了解 `users.json` 和 `invites.json` 的数据模型。
- 阅读 `references/reply-format.md`，了解响应示例。

## 内置脚本

- `scripts/link-user-identity.js`：把新的渠道身份绑定到已有用户。
- `scripts/migrate-user-to-uuid.js`：将历史用户记录迁移为基于 UUID 的用户 ID。
- `scripts/health-data-utils.js`：内置脚本使用的共享工具。
