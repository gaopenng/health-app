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
3. 写入 /Users/gaopeng/.health/invites.json，设置 expires_at = today + 7 days
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
1. 读取 /Users/gaopeng/.health/invites.json，查找 code 匹配项
2. 校验：code 存在 && used_by=null && expires_at > today
3. 若无效：回复"邀请码无效或已过期"
4. 若有效：
   a. 生成用户 dashboard_token（UUID v4）
   b. 在 users.json 追加新用户记录：
      - daily_report_target 默认为 dm:{sender_id}（私聊推送）
   c. 创建目录 /Users/gaopeng/.health/{sender_id}/
   d. 写入默认 profile.json：
      - daily_calorie_target: 2000
      - protein_target_g: 120
      - carb_target_g: 250
      - fat_target_g: 65
      - weekly_workout_target: 3
   e. 标记 invite code 的 used_by = 新用户 sender_id
   f. 回复注册成功消息 + 专属 Dashboard 链接
```

**回复格式：**

```
🎉 注册成功！欢迎使用健康管理助手
─────────────
你的专属数据看板：
https://health.pages.dev?token=xyz789
请妥善保存此链接，这是你的专属入口

发送"帮助"查看所有支持的指令
```

---

### 子功能 3：查看用户列表（/users）

**触发条件**：操作者 role=admin

**执行流程：**

```
1. 校验操作者 role=admin
2. 读取 /Users/gaopeng/.health/users.json
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
      "sender_id": "123456789",
      "name": "陛下",
      "role": "admin",
      "status": "active",
      "dashboard_token": "550e8400-e29b-41d4-a716-446655440000",
      "daily_report_target": "group:chat_id_xxx",
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

> `daily_report_target`：格式为 `group:{群组ID}` 或 `dm:{用户ID}`。注册时默认私聊，加入群组后可更新为群组。
