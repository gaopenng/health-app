---
name: user-manager
description: Manage user invitations, registration, identity mapping, and user listing for the health assistant. Use for admin invite generation, invite-code joins, username collection, new user creation, or listing users.
---

# user-manager

Manage health-assistant users.

## Intent routing

Choose one subflow first:

- invite generation
- user registration from invite code
- user list query

## Workflow

### Invite generation

1. Verify the operator has the `admin` role.
2. Generate a 6-character invite code using uppercase letters and digits without ambiguous characters.
3. Write the code to `invites.json` with a 7-day expiration.
4. Return the code with usage instructions.

### User registration

1. Read `invites.json` and validate the invite code.
2. If invalid or expired, return a rejection message.
3. If valid and username is missing:
   - ask the user how they want to be addressed
   - persist pending registration state with at least `code`, `channel`, and `sender_id`
4. After receiving a username:
   - ensure it is non-empty and unique
   - create `user_id` as UUID v4
   - create `dashboard_token` as UUID v4
   - append the user record to `users.json`
   - add the current identity to `identities[]`
   - create the user's directory
   - write the default `profile.json`
   - mark the invite as used
5. Return the success message and dashboard link.

### User listing

1. Verify the operator has the `admin` role.
2. Read `users.json`.
3. Return a formatted list of users.

## References

- Read `references/data-model.md` for `users.json` and `invites.json`.
- Read `references/reply-format.md` for response examples.

## Bundled scripts

- `scripts/link-user-identity.js`: link a new channel identity to an existing user.
- `scripts/migrate-user-to-uuid.js`: migrate a legacy user record to a UUID-based user ID.
- `scripts/health-data-utils.js`: shared helpers used by the bundled scripts.
