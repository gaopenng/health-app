# User manager data model

## users.json

```json
{
  "users": [
    {
      "user_id": "550e8400-e29b-41d4-a716-446655440000",
      "username": "akihi",
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

## invites.json

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

## Identity rules

- `user_id` is the stable internal primary key and directory name.
- `user_id` must be UUID v4.
- `username` should remain unique.
- `identities[]` maps channel identities for the same person.
