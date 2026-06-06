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
| `test-reset.sql`                         | **Active** | Used by `pnpm run db:test-reset` (non-prod only, DEC-095) |

See [`docs/phase-5/appendices/migrate-deploy-only.md`](../docs/phase-5/appendices/migrate-deploy-only.md).
