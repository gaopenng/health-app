---
name: daily-report
description: Generate a per-user daily health summary from diet, workout, weight, and profile data, then prepare a push-ready report with an actionable suggestion and dashboard link. Use when an agent needs to produce or deliver a user's daily health report, including scheduled daily report workflows.
---

# daily-report

Generate a daily health report for one user.

## Required input

- `user_sender_id`: channel sender ID used for delivery
- `user_id`: stable internal user ID
- `data_dir`: user data directory

## Workflow

1. Read today's diet file from `diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`.
2. Read today's workout file from `workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`.
   - If the file does not exist, treat the day as no workout.
3. Search backward up to 7 days for the latest weight file in `weight/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`.
4. Read `profile.json` for targets.
5. Summarize:
   - calorie progress versus target
   - protein status versus target
   - workout highlights or no-workout status
   - latest weight and recent change when prior data exists
6. Generate exactly one short, concrete, personalized suggestion.
   - Prioritize protein gap, calorie surplus, workout frequency, or weight trend.
7. Resolve the delivery target from the user's `daily_report_target`.
   - Accept `{channel}:group:{groupId}` and `{channel}:dm:{senderId}`.
   - Also accept legacy `group:{groupId}` and `dm:{senderId}`.
8. Append the user's dashboard link using `dashboard_token` from the user record.
9. Return a push-ready report in the correct channel format.

## Output requirements

- Include diet summary.
- Include workout summary.
- Include weight summary.
- Include one actionable suggestion.
- Include the dashboard link.
- Keep the final message concise and ready to send.

## References

- Read `references/report-format.md` for channel-specific output structure.
- Read `references/data-contract.md` for file expectations and field conventions.
