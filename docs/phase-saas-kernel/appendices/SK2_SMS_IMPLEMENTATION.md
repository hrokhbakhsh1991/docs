# SK2 SMS delivery implementation

## Scope

Workspace OTP delivery is implemented as a tenant-attributed integration delivery job. Platform
staff login uses the same server-managed Melipayamak account, but its queue scope and usage ledger
are platform-owned and have no tenant attribution. Platform staff login requires its own approved,
platform-branded Pattern via `BaseServiceNumber`. Neither path stores OTP plaintext in the
delivery-job payload. OTP variables are encrypted
with `SMS_DELIVERY_ENCRYPTION_KEY` until the worker sends the message.

Set `SMS_PROVIDER_MODE=platform`, `SMS_OTP_ENABLED=true`, `MELIPAYAMAK_USERNAME`,
`MELIPAYAMAK_API_KEY`, `SMS_OTP_TEMPLATE_ID`, `SMS_OTP_TEMPLATE_SCOPE`,
`SMS_PLATFORM_OTP_TEMPLATE_ID`, `SMS_PLATFORM_OTP_TEMPLATE_SCOPE=platform`, and a valid
`SMS_DELIVERY_ENCRYPTION_KEY` in the API/worker environment. The platform template must be
approved separately; it never falls back to a workspace template. Missing configuration fails
closed. A workspace template scope is the approved workspace type, or `*` only for a
provider-approved common template. Static OTP cannot be enabled in platform mode. Jobs previously queued
against workspace connections retain their original delivery route during migration.
Central OTP requests also require Redis. Atomic per-minute limits apply to each
tenant, shared provider account and keyed-hash mobile; defaults are 30, 120 and 10.
If Redis is unavailable, a central OTP request is rejected before enqueue.

## Workspace usage accounting

Every Melipayamak attempt writes one `sms_usage_events` row keyed by delivery
job and attempt number. The row contains tenant/workspace, purpose, template,
provider message id, status, error code, segment count (when available), and a
SHA-256 recipient hash. The recipient itself and provider credentials are not
stored in the usage record.

This gives the platform a stable accounting seam for future per-workspace
budgets, dashboards, alerts, and billing without coupling those features to the
provider adapter.

Platform staff OTP attempts are recorded separately in `platform_sms_usage_events`, which has no
tenant key and is accessible only to the background delivery role. Workspace usage counts and
reports are not affected by platform staff authentication.

The read-only workspace report covers the latest outcome per delivery job in
the last 30 days. It exposes counts for provider-accepted, failed and unknown
outcomes to workspace owners and administrators only. A reserved `attempted`
row is shown as unknown. Costs remain unavailable until verified provider
segment and pricing data exist. An attempt is recorded before contacting the
provider; an existing uncertain attempt must not be sent again automatically.

## Activation checklist

1. Review pending SMS jobs and existing workspace connections before switching mode.
2. Store the platform web-service username and APIKey in the server environment,
   outside source control. The provider `password` field carries the APIKey, not
   the panel login password.
3. Configure a Pattern approved for its intended audience, with one variable:
   the numeric OTP only. A Denali-branded Pattern must not be reused for
   unrelated workspaces without provider approval.
4. Configure an authorized test recipient before sending a connection test;
   provider messages incur the normal SMS charge.
5. Set a unique 32-byte `SMS_DELIVERY_ENCRYPTION_KEY` for each environment.
6. Set `SMS_OTP_ENABLED=true` only after the connection and key are verified.
7. Run one staging OTP and inspect the delivery result plus `sms_usage_events`.
8. Promote the same artifact and configuration shape to production.

Provider credentials and the encryption key must never be committed or printed
in logs. Platform mode rejects static OTP; a network or server failure with an
unknown send outcome must not be retried automatically.

## Real-code rollout contract (2026-11-04)

Random OTPs use four digits; explicitly enabled static fixtures also use four. The issued challenge carries non-secret length metadata through Admin and Portal BFFs to all input surfaces, including the Marketing PDP modal. Each challenge is invalidated after five incorrect guesses using its persisted attempt counter. See [OTP challenge length](../../standards/otp-challenge-length.mdoc). Do not disable static fixtures on a live environment until a matching client is deployed and handset delivery is verified.

The REST adapter accepts the official `Value` / `RetStatus` envelope and rejects unsuccessful HTTP or provider responses, including numeric error values. Reference: [official Melipayamak REST SDK](https://github.com/Melipayamak/melipayamak-Asp.net-Core/blob/master/RestClientAsync.cs). A successful provider response establishes submission, not handset delivery.
