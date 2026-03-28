# Diet reply format

The dashboard link in the confirmation is part of the normal expected output whenever `dashboard_token` and `dashboard_public_base_url` are available.

All four daily totals must include a progress bar: calories, protein, carbs, and fat. This is mandatory, not optional.
The confirmation must also include a brief recommendation based on the user's targets and current daily intake. This is mandatory.

## Confirmation example

```text
✅ [sender_name 的]午餐已记录[（图片识别）]
─────────────
米饭      约 200g  ~232 kcal
鸡胸肉    约 150g  ~165 kcal  蛋白质 ~31g
─────────────
本餐合计：~397 kcal
今日累计热量：897 / 2000 kcal ▓▓▓▓░░░░░░ 45%
今日累计蛋白质：82 / 120 g ▓▓▓▓▓▓▓░░░ 68%
今日累计碳水：109 / 250 g ▓▓▓▓░░░░░░ 44%
今日累计脂肪：29 / 65 g ▓▓▓▓░░░░░░ 45%
建议：今天蛋白质还差得不多，后面优先补一点优质蛋白和蔬菜；碳水还有空间，晚餐主食控制在正常份量即可。

[📊 查看数据看板]
```

Group chats may prefix the sender name. Private chats may omit it.
