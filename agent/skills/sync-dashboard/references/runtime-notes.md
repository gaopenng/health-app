# Runtime notes

## Publish expectations

- For this repository, a direct build -> commit -> push flow is acceptable.
- Trigger this flow only for explicit dashboard-view requests.
- Keep the push scope narrow: only publish `dashboard_data_dir` changes.
- If the dashboard JSON output is unchanged, skip commit and skip push.
- Pushing the current branch is what triggers Cloudflare Pages deployment in the default setup.
