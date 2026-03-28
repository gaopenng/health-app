---
name: weekly-review
description: Generate a per-user weekly health review from diet, workout, weight, and profile data, then prepare a push-ready weekly summary with concrete next-step suggestions and a dashboard link. Use when an agent needs to produce or deliver a weekly health review, including scheduled weekly review workflows.
---

# weekly-review

Generate a weekly health review for one user.

## Required input

- `user_sender_id`: channel sender ID used for delivery
- `user_id`: stable internal user ID
- `data_dir`: user data directory

## Workflow

1. Read the current week's files from Monday through Sunday:
   - `diet/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
   - `workout/{YYYY}/{YYYY-MM}/{YYYY-MM-DD}.json`
   - latest weight file from the same week
2. Read `profile.json` for weekly and daily targets.
3. Compute:
   - total and average calories
   - average protein, carb, and fat
   - workout days versus target
   - weight change from first available weekly weight to latest weekly weight
4. Generate 2 to 3 concrete suggestions for next week.
5. Resolve the delivery target from `daily_report_target`.
6. Append the dashboard link using `dashboard_token`.
7. Return a push-ready weekly review.

## Output requirements

- Include weekly diet summary.
- Include workout frequency and highlights.
- Include weight trend.
- Include 2 to 3 specific next-step suggestions.
- Include the dashboard link.

## References

- Read `references/report-format.md` for response structure.
- Read `references/data-contract.md` for file and field conventions.
