# Daily report data contract

## Inputs

- `user_sender_id`: delivery identity for the current user
- `user_id`: stable internal user ID
- `data_dir`: user data directory

## Files to read

- `diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
- `workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
- `weight/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json` (search latest within 7 days)
- `profile.json`
- shared `users.json` entry for `daily_report_target` and `dashboard_token`

## Delivery target formats

Preferred:

- `{channel}:group:{groupId}`
- `{channel}:dm:{senderId}`
