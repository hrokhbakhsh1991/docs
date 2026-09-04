# Phase L1 — Ticketing Production V1 Rollback Plan

## Immediate rollback (no schema revert)

1. **Disable module per tenant** — remove `ticketing` from theme `enabledModules` or set `workspaceTicketing.supported: false` in workspace manifest for the club.
2. **API behavior** — routes return `TICKET_MODULE_DISABLED` (404); fail-closed.
3. **UI** — Portal `/me/tickets` and Web `/tickets` nav hidden via entitlement gate.
4. **Data** — all ticket rows, messages, attachments metadata, SLA, templates **retained** in Postgres.

## Partial rollback (sub-features)

| Feature | Rollback lever |
|---------|----------------|
| SLA worker | `TICKETING_SLA_WORKER_ENABLED=false` |
| Email/SMS templates | disable template rows or notification channel flags in settings |
| Attachments | `workspaceTicketing.capabilities.attachments: false` in manifest |
| Reports export | revoke admin export route at gateway (optional); settings unchanged |

## Settings rollback

- `PATCH /ticket-settings` with prior `rowVersion` or restore from `operator_settings_audit_events` (`resourceType=ticketing_settings`)
- Manifest baseline always wins for categories not overridden in DB

## Template rollback

- `POST /ticket-templates/:code/rollback` per channel/locale
- Automation idempotent activations remain (no duplicate sends on re-enable)

## Database rollback

- **Production:** do **not** drop ticketing tables in place; forward-only migrations.
- Emergency read-only: revoke `app_tour` DML grants on `ticket_*` tables (break-glass only).

## Verification after rollback

- Member receives 404 on `/member/tickets`
- Operator inbox route 404 / nav hidden
- No new outbox notification jobs for ticketing events
- Existing audit trail intact

## Re-enable

1. Re-apply manifest + theme flags
2. Confirm migrations already applied (`prisma migrate status`)
3. Run targeted smoke: `portal-member-tickets-smoke` + `operator-ticketing-inbox`
