# User manager reply format

## Invite created

```text
🔑 邀请码已生成
─────────────
邀请码：ABC123
有效期：7 天（至 2026-03-31）
使用方式：让对方发送“加入 ABC123”
```

## Registration guidance

```text
您还没注册。
请联系管理员发送 /invite 获取邀请码。
拿到邀请码后，发送：加入 ABC123
我会继续问你怎么称呼，并为你创建专属档案。
```

In group chats, append a reminder to @ the bot first if required by the platform.

## Registration success

```text
🎉 注册成功！欢迎使用健康管理助手
─────────────
你的专属数据看板：
{dashboard_public_base_url}/?token=xyz789
请妥善保存此链接，这是你的专属入口

发送“帮助”查看所有支持的指令
```

## User list

```text
👥 用户列表（共 3 人）
─────────────
1. 陛下（admin）
   注册：2026-03-23  最后活跃：2026-03-24
2. 张三
   注册：2026-03-25  最后活跃：2026-03-25
3. 李四
   注册：2026-03-26  最后活跃：2026-03-26
```
