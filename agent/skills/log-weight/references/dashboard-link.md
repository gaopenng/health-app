# Dashboard link resolution

## Required inputs

- `dashboard_token` from the user's record in `users.json`
- `dashboard_public_base_url` from project configuration or runtime context

## Output rule

When both values are available, append a dashboard link to the final confirmation.

## URL pattern

```text
{dashboard_public_base_url}/?token={dashboard_token}
```

## Fallback

If either the token or base URL is unavailable, omit the link rather than fabricating one.
