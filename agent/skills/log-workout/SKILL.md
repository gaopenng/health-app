---
name: log-workout
description: Parse workout messages into exercises, sets, reps, weights, or duration, append the daily workout record, and confirm the logged training summary. Use for strength or cardio workout logging from chat.
---

# log-workout

Record one workout update.

## Required input

- `user_sender_id`
- `user_id`
- `user_channel`
- `data_dir`
- `content`
- `reply_target`
- `sender_name`

## Workflow

1. Parse the workout description into normalized exercise data.
2. For each exercise, determine:
   - `name`
   - `category`
   - strength sets, reps, and weight when present
   - cardio duration when present
3. Build a validated payload for `scripts/append-workout-entry.js`.
4. Let the script compute `total_volume_kg` for strength movements and append the exercise to today's workout file.
5. Resolve the user's dashboard link.
   - Read `dashboard_token` from the user's record.
   - Combine it with `dashboard_public_base_url` from project configuration or runtime context.
6. Trigger `sync-dashboard` asynchronously.
7. Reply with a concise confirmation, the logged training summary, and the dashboard link when available.

## Error handling

- If the workout message cannot be parsed into a reliable record, ask the user to resend it in a clearer structure.
- If script validation fails, correct the payload and retry.

## Output requirements

- Include the dashboard link whenever `dashboard_token` and `dashboard_public_base_url` are available.
- Treat the dashboard link as part of the normal confirmation rather than optional decoration.

## References

- Read `references/payload-schema.md` for script input.
- Read `references/parsing-examples.md` for normalization examples.
- Read `references/workout-file-format.md` for the persisted structure.
- Read `references/reply-format.md` for the confirmation layout.
- Read `references/dashboard-link.md` for dashboard URL resolution.

## Bundled scripts

- `scripts/append-workout-entry.js`: validates payloads, computes derived fields, and appends workout entries.
- `scripts/health-data-utils.js`: shared file helpers used by the bundled script.
