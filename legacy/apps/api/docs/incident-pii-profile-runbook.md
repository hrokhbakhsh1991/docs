# Incident runbook: profile / PII (`/api/v2/me`)

## Scope

User-editable PII on the global `users` row: name, national ID, gender, birth date, email, phone, notification preference. Related tables: `email_verification_tokens`, tenant audit stream (`tenant_audit_events`).

## Detection

- Spike in `409` **`PROFILE_ROW_VERSION_CONFLICT`** (benign: clients on stale `ETag`; educate or refresh UI).
- Spike in `409` **`USER_NATIONAL_ID_CONFLICT`** / **`USER_EMAIL_CONFLICT`** / **`USER_PHONE_CONFLICT`** (possible abuse or duplicate data entry).
- Outbox backlog for **`identity.email_verification.send`** (email delivery degraded).
- SIEM on **`profile.self.pii_updated`**, **`profile.email.*`**, **`profile.phone.updated_self`** for unusual volume or actor patterns.

## Immediate response

1. **Do not** paste raw national IDs, full emails, or tokens into public tickets or Slack.
2. Confirm whether the incident is **application** (validation, concurrency) vs **data leak** (unauthorized export, mis-routed logs). For suspected leak: rotate affected credentials, preserve audit export slice (time-bounded), involve legal/privacy owner.
3. For **DB restore / bad migration**: restore from snapshot; re-run migrations in order; verify `users.profile_row_version` column exists if optimistic locking errors appear as `500` / schema drift.

## Operational knobs

- **E2E / local auth**: `AUTH_ALLOW_DEV_STATIC_OTP=true` is required for web OTP tests that use the fixed `1234` code; never enable in production.
- **Email worker**: `OUTBOX_PROCESSOR_ENABLED`, Resend keys (`RESEND_API_KEY`, `RESEND_FROM`), `FRONTEND_BASE_URL` for verification links.
- **Token cleanup**: scheduled job `email_verification_tokens_cleanup` (expired rows); check logs for delete counts.
- **Idempotent PATCH**: optional `Idempotency-Key` header; TTL via `IDEMPOTENCY_TTL_MS`.

## Post-incident

- Review tenant audit export for affected `tenant_id` and window.
- If national ID at-rest encryption is required by policy, track as separate security initiative (not implied by current schema).
