---
name: sync-dashboard
description: Aggregate user health data into dashboard JSON files and trigger a debounced publish flow after logging changes. Use when diet, workout, or weight updates should refresh dashboard data for one or more active users.
---

# sync-dashboard

Refresh dashboard data after health records change.

## Workflow

1. Check whether a dashboard sync is already pending.
2. If no sync is pending, schedule one debounced publish window.
3. If a sync is already pending and the scheduled time has not arrived, return without triggering another publish.
4. When the publish window opens:
   - read active users from `users.json`
   - aggregate each active user's dashboard data
   - write one dashboard JSON file per user token
   - call `scripts/build-dashboard-data.js` for deterministic aggregation when appropriate
   - trigger the dashboard publish flow
5. Clear the pending sync state after a successful publish.

## Output requirements

- Avoid duplicate publishes during the debounce window.
- Generate dashboard JSON from the latest health data.
- Keep the publish step idempotent where possible.

## References

- Read `references/dashboard-schema.md` for output structure.
- Read `references/runtime-notes.md` for debounce and deployment expectations.

## Bundled scripts

- `scripts/build-dashboard-data.js`: builds dashboard JSON files for active users or filtered targets.
- `scripts/health-data-utils.js`: shared health-data helpers used by the build script.
