# Diet reply format

The dashboard link in the confirmation is part of the normal expected output whenever `dashboard_token` and `dashboard_public_base_url` are available.

## Confirmation example

```text
✅ [sender_name 的]午餐已记录[（图片识别）]
─────────────
米饭      约 200g  ~232 kcal
鸡胸肉    约 150g  ~165 kcal  蛋白质 ~31g
─────────────
本餐合计：~397 kcal
今日累计热量：897 / 2000 kcal ▓▓▓▓░░░░░░ 45%
今日累计蛋白质：82 g
今日累计碳水：109 g
今日累计脂肪：29 g

[📊 查看数据看板]
```

Group chats may prefix the sender name. Private chats may omit it.
