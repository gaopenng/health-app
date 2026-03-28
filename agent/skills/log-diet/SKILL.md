---
name: log-diet
description: Record diet entries from meal text or food images, estimate calories and macros, write the daily diet record, and reply with updated daily totals. Use for meal logging in chat, including image-based food intake capture.
---

# log-diet

Record one meal or snack into the user's daily diet record.

## Required input

- `user_sender_id`
- `user_id`
- `user_channel`
- `data_dir`
- `input_type`: `text` or `image`
- `content`
- `reply_target`
- `sender_name`
- `meal_time` when the user explicitly provides a time reference

## Workflow

1. If `input_type=image`, identify the foods and estimate portions from the image.
2. Estimate for the meal:
   - calories
   - protein
   - carb
   - fat
3. Determine `meal_type` from the user's instruction or the resolved local time.
4. If `meal_type=snack`, determine `snack_period`.
5. Build a validated payload for the diet append script.
6. Call `scripts/append-diet-entry.js` with the payload.
   - Do not hand-write the target JSON file directly.
   - The bundled script uses the bundled `scripts/health-data-utils.js` helper.
7. If the script returns a validation error, correct the payload and retry.
8. Read `profile.json` for daily targets.
9. Use the script's returned `daily_totals` for all cumulative values in the reply.
10. Resolve the user's dashboard link.
    - Read `dashboard_token` from the user's record.
    - Combine it with `dashboard_public_base_url` from project configuration or runtime context.
11. Trigger `sync-dashboard` asynchronously without blocking the user-facing confirmation.
12. Return a confirmation message with the dashboard link when available.

## Output requirements

- Start with a clear confirmation that the meal was recorded.
- Include the meal estimate.
- Include today's cumulative calories, protein, carb, and fat.
- Include the dashboard link whenever `dashboard_token` and `dashboard_public_base_url` are available.
- Treat the dashboard link as part of the normal confirmation rather than optional decoration.
- In image mode, do not stop at image commentary; always record the meal first.
- Keep optional advice short and secondary.

## Error handling

- If the image does not contain recognizable food, ask the user to describe what they ate.
- If validation fails, repair the payload and retry.
- If writing still fails, return a brief retry message and log the failure.

## References

- Read `references/payload-schema.md` for the script payload.
- Read `references/diet-file-format.md` for the persisted file structure.
- Read `references/reply-format.md` for confirmation examples.
- Read `references/dashboard-link.md` for dashboard URL resolution.

## Bundled scripts

- `scripts/append-diet-entry.js`: validates payloads and appends diet records.
- `scripts/health-data-utils.js`: shared file and normalization helpers used by the script.
