# SK2 SMS delivery implementation

## Scope

OTP delivery is implemented as a workspace-scoped integration delivery job. The
Melipayamak adapter uses the standard `SendSMS` API with the account's dedicated
sender line when no Pattern exists; an approved Pattern via `BaseServiceNumber`
remains supported. It never stores the OTP in plaintext in the delivery-job
payload. OTP variables are encrypted
with `SMS_DELIVERY_ENCRYPTION_KEY` until the worker sends the message.

The integration is opt-in: `SMS_OTP_ENABLED` must be explicitly `true`, a
workspace-scoped enabled `melipayamak` connection must exist, and its sender
line must be configured. When the flag is disabled, the existing delivery path
remains active.

## Workspace usage accounting

Every Melipayamak attempt writes one `sms_usage_events` row keyed by delivery
job and attempt number. The row contains tenant/workspace, purpose, template,
provider message id, status, error code, segment count (when available), and a
SHA-256 recipient hash. The recipient itself and provider credentials are not
stored in the usage record.

This gives the platform a stable accounting seam for future per-workspace
budgets, dashboards, alerts, and billing without coupling those features to the
provider adapter.

## Activation checklist

1. Create an enabled `melipayamak` connection for the target workspace and set
   the approved sender line (currently `50002710052870` in the account panel).
2. Store the Melipayamak web-service username and APIKey through the existing
   secret store. The `password` credential field carries the APIKey shown under
   the panel's Web service settings; it is not the panel login password.
3. If a Pattern is approved later, configure its `bodyId` with one variable;
   the variable contains the numeric code `1234` followed by the
   Admin-configured workspace display name. This keeps the existing one-variable
   Pattern compatible; otherwise standard SendSMS is used.
4. Configure a test recipient and use the connection test; it sends `1234` plus
   the Admin-configured workspace name and incurs the provider's normal SMS charge.
5. Set a unique 32-byte `SMS_DELIVERY_ENCRYPTION_KEY` for each environment.
6. Set `SMS_OTP_ENABLED=true` only after the connection and key are verified.
7. Run one staging OTP and inspect the delivery result plus `sms_usage_events`.
8. Promote the same artifact and configuration shape to production.

The approved static OTP contract may remain enabled: the same code is encrypted
into the SMS job and delivered by the provider. Provider credentials and the
encryption key must never be committed or printed in logs.
