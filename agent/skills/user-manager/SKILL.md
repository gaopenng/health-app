# user-manager

用户管理 Skill，处理邀请码生成、新用户注册和用户列表查询。

## 子功能

---

### 子功能 1：生成邀请码（/invite）

**触发条件**：操作者 role=admin

**执行流程：**

```
1. 校验操作者 role=admin（读取 users.json 验证）
2. 生成 6 位大写字母数字组合：
   - 字符集 32 个（A-Z + 2-9，排除易混淆的 0/O/I/1）
3. 写入 {health_data_dir}/invites.json，设置 expires_at = today + 7 days
4. 返回邀请码和使用说明
```

**回复格式：**

```
🔑 邀请码已生成
─────────────
邀请码：ABC123
有效期：7 天（至 2026-03-31）
使用方式：让对方发送"加入 ABC123"
```

---

### 子功能 2：用户注册（"加入 {CODE}"）

**执行流程：**

```
1. 读取 {health_data_dir}/invites.json，查找 code 匹配项
2. 校验：code 存在 && used_by=null && expires_at > today
3. 若无效：回复"邀请码无效或已过期"
4. 若有效但尚未拿到 username：
   a. 回复：`怎么称呼你？请回复一个你希望使用的 username`
   b. 暂存这次待注册状态（至少要记住 code、channel、sender_id）
   c. 等用户回复 username 后继续
5. 收到 username 后：
   a. 校验 username 非空，且在 users.json 中不重复
   b. 生成内部 `user_id`（UUID v4）与用户 `dashboard_token`（UUID v4）
   c. 在 users.json 追加新用户记录：
      - `user_id` 为内部主键，必须为 UUID v4
      - `username` 为用户自己提供的稳定称呼
      - `identities[]` 至少写入当前这条 `{channel, sender_id}`
      - `daily_report_target` 默认为 `{channel}:dm:{sender_id}`；旧数据兼容 `dm:{sender_id}`
   d. 创建目录 {health_data_dir}/{user_id}/
   e. 写入默认 profile.json：
      - daily_calorie_target: 2000
      - protein_target_g: 120
      - carb_target_g: 250
      - fat_target_g: 65
      - weekly_workout_target: 3
   f. 标记 invite code 的 used_by = 新用户 user_id
   g. 回复注册成功消息 + 专属 Dashboard 链接
```

**回复格式：**

```
🎉 注册成功！欢迎使用健康管理助手
─────────────
你的专属数据看板：
{dashboard_public_base_url}/?token=xyz789
请妥善保存此链接，这是你的专属入口

发送"帮助"查看所有支持的指令
```

---

### 子功能 3：查看用户列表（/users）

**触发条件**：操作者 role=admin

**执行流程：**

```
1. 校验操作者 role=admin
2. 读取 {health_data_dir}/users.json
3. 格式化返回用户列表
```

**回复格式：**

```
👥 用户列表（共 3 人）
─────────────
1. 陛下（admin）
   注册：2026-03-23  最后活跃：2026-03-24
2. 张三
   注册：2026-03-25  最后活跃：2026-03-25
3. 李四
   注册：2026-03-26  最后活跃：2026-03-26
```

---

## 数据文件格式

**users.json：**

```json
{
  "users": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "akihi",
      "sender_id": "123456789",
      "channel": "telegram",
      "identities": [
        {
          "channel": "telegram",
          "sender_id": "123456789"
        },
        {
          "channel": "feishu",
          "sender_id": "ou_xxx"
        }
      ],
      "name": "陛下",
      "role": "admin",
      "status": "active",
      "dashboard_token": "550e8400-e29b-41d4-a716-446655440000",
      "daily_report_target": "telegram:group:chat_id_xxx",
      "registered_at": "2026-03-23",
      "last_active_at": "2026-03-24"
    }
  ]
}
```

**invites.json：**

```json
{
  "invites": [
    {
      "code": "ABC123",
      "created_by": "123456789",
      "used_by": null,
      "created_at": "2026-03-23",
      "expires_at": "2026-03-30"
    }
  ]
}
```

## 身份映射约定

- `user_id` 是内部稳定主键，也是数据目录名
- `user_id` 必须为 UUID v4
- `username` 是用户自定义的可读名称，应保持唯一
- `identities[]` 是渠道身份映射，同一个真人跨 Telegram / 飞书时应追加身份，而不是新建第二个用户
- 旧格式只有顶层 `sender_id` 的用户记录仍需兼容读取

> `daily_report_target` 推荐格式为 `{channel}:group:{群组ID}` 或 `{channel}:dm:{用户ID}`。旧格式 `group:{群组ID}` / `dm:{用户ID}` 仍需兼容读取。
