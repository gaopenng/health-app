---
name: log-weight
description: Extract body weight values from natural-language chat messages, normalize units, write the daily weight record, and reply with change versus the latest prior record. Use for body weight logging in chat.
---

# log-weight

Record one body-weight entry.

## Required input

- `user_sender_id`
- `user_id`
- `user_channel`
- `data_dir`
- `content`
- `reply_target`
- `sender_name`

## Workflow

1. Extract the weight value from the user's message.
2. Normalize to kilograms.
   - `斤`: divide by 2
   - `lb` or `lbs`: multiply by `0.453592`
   - `kg`: use directly
3. Build a validated payload for `scripts/append-weight-entry.js`.
4. Call `scripts/append-weight-entry.js` to write today's weight record and fetch the latest prior record.
5. Resolve the user's dashboard link.
   - Read `dashboard_token` from the user's record.
   - Combine it with `dashboard_public_base_url` from project configuration or runtime context.
6. Trigger `sync-dashboard` asynchronously.
7. Reply with the recorded weight, the change versus the latest prior record when available, and the dashboard link when available.

## Error handling

- If no reliable weight value can be extracted, ask the user to send the number again with a unit.
- If script validation fails, correct the payload and retry.

## Output requirements

- Include the dashboard link whenever `dashboard_token` and `dashboard_public_base_url` are available.
- Treat the dashboard link as part of the normal confirmation rather than optional decoration.

## References

- Read `references/payload-schema.md` for script input.
- Read `references/weight-file-format.md` for the persisted structure.
- Read `references/reply-format.md` for the confirmation layout.
- Read `references/dashboard-link.md` for dashboard URL resolution.

## Bundled scripts

- `scripts/append-weight-entry.js`: validates payloads, writes daily weight records, and returns prior-record delta data.
- `scripts/health-data-utils.js`: shared file helpers used by the bundled script.
