# Weight reply format

The dashboard link in the confirmation is part of the normal expected output whenever `dashboard_token` and `dashboard_public_base_url` are available.

```text
⚖️ [sender_name 的]体重已记录
─────────────
今日体重：75.2 kg
较上次（75.8 kg）：↓ 0.6 kg

[📊 查看数据看板]
```

If there is no prior record, omit the comparison line.
