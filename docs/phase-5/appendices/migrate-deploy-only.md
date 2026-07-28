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
| App role name (SoT)   | **`app_tour`** — matches `DATABASE_URL` + Prisma `GRANT`/`ALTER ROLE` migrations. Init must **not** create `app_cloud` (hostile-audit rename regression). |
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

## Owner URL wiring (DEC-124)

`pnpm run db:migrate:deploy` runs [`apps/api/scripts/db-migrate-deploy.mjs`](../../../apps/api/scripts/db-migrate-deploy.mjs), which passes **`DATABASE_URL_ADMIN`** to Prisma when set, otherwise falls back to `DATABASE_URL`.

Gate jobs export both URLs (`app_tour` for runtime RLS tests, `postgres` for DDL). Without the admin override, `app_tour` lacks `CREATE` on `public` and migrate deploy fails with `permission denied for schema public`.

GHA workflows run:

```bash
DATABASE_URL="$DATABASE_URL_ADMIN" pnpm --filter @apps/api run db:migrate:deploy
```

The wrapper also prefers `DATABASE_URL_ADMIN` when set — double wiring so a stale `DATABASE_URL=app_tour` job env cannot regress CI.

## Commands

```bash
# Production / CI / local gate
export DATABASE_URL_ADMIN='postgresql://postgres:postgres@127.0.0.1:5434/tour_db'
export DATABASE_URL='postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db?connection_limit=32'
psql "$DATABASE_URL_ADMIN" -f docs/phase-4/dev/init/01-app-role.sql 2>/dev/null || true
cd apps/api && pnpm run db:migrate:deploy

# Authoring new migration (local dev only — NOT gate)
pnpm --filter @apps/api exec prisma migrate dev --name my_change
```

### Prisma client regeneration (M1 / Phase 9.2)

`db:migrate:deploy` runs **`prisma generate`** immediately after a successful
`migrate deploy`. This keeps `@prisma/client` aligned with new columns/models
(for example `exposure_intents.fieldDecorations`) so a restarted API process does
not throw `Unknown field` at runtime.

Local dev checklist after pulling migrations:

```text
pnpm --filter @apps/api run db:migrate:deploy   # deploy + generate
# restart API (pnpm dev / process manager)
```

If you run `migrate deploy` manually without the wrapper, run
`pnpm --filter @apps/api run prisma:generate` before booting the API.

## Verification

```bash
cd apps/api
pnpm run guard:migrate-deploy-only
pnpm run phase-5:evolution-gate
```

## Schema sync for BP-7 portal member plans

Migration `20260721100000_portal_member_plans_bp7` creates `portal_member_plans`. Prisma model **`PortalMemberPlan`** in `apps/api/prisma/schema.prisma` must stay aligned so `prisma generate` exposes `tx.portalMemberPlan` for `PrismaPortalMemberPlanRepository`. Adding SQL without the model breaks API `tsc` on clean CI.
