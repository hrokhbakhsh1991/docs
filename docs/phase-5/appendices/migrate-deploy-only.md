# Prisma migrate deploy only — CI/prod parity (DEC-124)

```yaml
status: implemented
phase: 5 evolution — Platform 5.7
closes: MD-GAP-05, MD-GAP-06, MD-GAP-04 (partial)
related: migration-head-preflight.md DEC-097, production-deploy-checklist.md
```

## Problem

| Gap           | Issue                                                                               |
| ------------- | ----------------------------------------------------------------------------------- |
| **MD-GAP-05** | CI/gate docs used `migrate dev` + manual `infra/sql/001` — diverges from production |
| **MD-GAP-06** | Parallel `infra/sql/001…004` track drifted vs Prisma migration ordering             |
| **MD-GAP-04** | No canonical `db:migrate:deploy` script in `package.json`                           |

GHA workflows applied redundant `001_tenant_rls.sql` and manual `last_error` DDL after `migrate deploy`, even though Prisma migrations already include `20260605180000_tours_rls`, `20260605120000_phase5_outbox_audit_rls`, and `20260605200000_outbox_last_error`.

## Decision

| Item                  | Choice                                                                           |
| --------------------- | -------------------------------------------------------------------------------- |
| Bootstrap (gate/prod) | `01-app-role.sql` (once) → **`pnpm run db:migrate:deploy`**                      |
| `migrate dev`         | **Authoring only** — local creation of new `migration.sql`; forbidden in CI/gate |
| `infra/sql/001…004`   | **Reference-only** — historical mirror; do not execute in CI/ops                 |
| Exception             | `infra/sql/test-reset.sql` for `pnpm run db:test-reset` (DEC-095 prod-block)     |

### Prisma migration coverage (sole SoT)

| Legacy `infra/sql`                       | Prisma migration                                |
| ---------------------------------------- | ----------------------------------------------- |
| `001_tenant_rls.sql` (tours RLS)         | `20260605180000_tours_rls`                      |
| `002_phase5_data_layer.sql`              | `20260605120000_phase5_outbox_audit_rls`        |
| `003_phase5_processed_domain_events.sql` | `20260605140000_phase5_processed_domain_events` |
| `004_audit_events_append_only.sql`       | `20260605150000_audit_events_append_only`       |
| manual `last_error`                      | `20260605200000_outbox_last_error`              |

```mermaid
flowchart LR
  role[01-app-role.sql] --> deploy[db:migrate:deploy]
  deploy --> app[API boot + gates]
```

## Commands

```bash
# Production / CI / local gate (owner URL)
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
psql "$DATABASE_URL_ADMIN" -f docs/phase-4/dev/init/01-app-role.sql 2>/dev/null || true
cd apps/api && pnpm run db:migrate:deploy

# Authoring new migration (local dev only — NOT gate)
pnpm --filter @apps/api exec prisma migrate dev --name my_change
```

## Verification

```bash
cd apps/api
pnpm run guard:migrate-deploy-only
pnpm run phase-5:evolution-gate
```
