# infra/sql — REFERENCE ONLY (DEC-124)

> **Do not execute `001…004` in CI, production, or gate bootstrap.**  
> Schema truth is **`apps/api/prisma/migrations/`** via `pnpm run db:migrate:deploy`.

## File map

| File                                     | Status     | Prisma equivalent                                         |
| ---------------------------------------- | ---------- | --------------------------------------------------------- |
| `001_tenant_rls.sql`                     | Reference  | `20260605180000_tours_rls`                                |
| `002_phase5_data_layer.sql`              | Reference  | `20260605120000_phase5_outbox_audit_rls`                  |
| `003_phase5_processed_domain_events.sql` | Reference  | `20260605140000_phase5_processed_domain_events`           |
| `004_audit_events_append_only.sql`       | Reference  | `20260605150000_audit_events_append_only`                 |
| `005_tenant_routes.sql`                  | Reference  | `20260607100000_tenant_routes` (Phase 7.7)                |
| `010_identity_production_delta.sql`      | Reference  | `20260609100000_identity_production_delta` (Phase 9.1)    |
| `011_wallet_member_accounts_delta.sql`   | Reference  | `20260902120000_wallet_member_accounts_rls` (WALLET-P2C)  |
| `006_operator_bookings_delta.sql`        | Reference  | `20260609110000_operator_bookings_delta` (Phase 9.5)      |
| `007_operator_settings_delta.sql`      | Reference  | `20260609120000_operator_settings_delta` (Phase 9.6)    |
| `test-reset.sql`                         | **Active** | Used by `pnpm run db:test-reset` (non-prod only, DEC-095) |

See [`docs/phase-5/appendices/migrate-deploy-only.md`](../docs/phase-5/appendices/migrate-deploy-only.md).
