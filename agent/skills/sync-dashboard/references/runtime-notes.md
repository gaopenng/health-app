# Runtime notes

## Debounce expectations

- Use one shared pending state, such as `sync_lock.json`.
- A 5-minute debounce window is acceptable for reducing redundant publishes.
- If another update arrives before the scheduled publish time, allow the existing pending sync to cover it.

## Publish expectations

The publish flow may use repository commits and pushes to trigger static-site deployment. Keep this as an implementation detail of the environment rather than core skill logic.
