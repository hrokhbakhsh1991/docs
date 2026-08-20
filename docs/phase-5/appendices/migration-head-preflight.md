# Migration head preflight at boot (DEC-097 / MD-GAP-12)

```yaml
status: implemented
phase: 5 evolution — P0 Phase 1
closes: MD-GAP-12, RB-GAP-04 (partial)
related: phase5-evolution-audit.md § Migration Danger recommendations
```

## Problem

After a failed `migrate deploy`, the DB schema may sit at migration **N-1** while the container image expects **N**. The API boots and serves traffic against a skewed schema — no fail-fast check ([MD-GAP-12](phase5-evolution-audit.md)).

## Decision

| Item     | Choice                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| When     | Production boot only (`isProductionAuthMode()` + `STORAGE_DRIVER=prisma`)                                         |
| Probe    | `SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1` |
| Expected | `EXPECTED_PRISMA_MIGRATION_HEAD` constant in `src/db/migration-head-preflight.ts`                                 |
| Failure  | `throw new Error("PRODUCTION_MIGRATION_HEAD_MISMATCH:…")` — `main.ts` exits 1                                     |
| Guard    | `guard:migration-head-preflight` — constant must match latest `prisma/migrations/*` folder                        |

## Operator playbook

1. Run `pnpm exec prisma migrate deploy` with owner URL before rolling new image.
2. If deploy fails, fix SQL and redeploy — do **not** start API until `_prisma_migrations` head matches embedded constant.
3. After adding a migration, bump `EXPECTED_PRISMA_MIGRATION_HEAD` in the same PR.

## Head history (embedded constant)

| Migration folder                   | Landed in | Purpose                                                       |
| ---------------------------------- | --------- | ------------------------------------------------------------- |
| `20260605200000_outbox_last_error` | Phase 5   | Outbox `last_error` column                                    |
| `20260607100000_tenant_routes`     | Phase 7.7 | `tenant_routes` DDL for `TenantConnectionRouter` (REQ-P7-021) |
| `20260608100000_urban_product_delta` | Phase 8.2 | Urban `publish_status` + registration intake columns |
| `20260706130000_app_cloud_nosuperuser` | Phase 5/ops | App role NOSUPERUSER hardening |
| `20260720140000_finance_recon_rls` | MR-P0-003 | Finance recon findings RLS + tip head sync |
| `20260720170000_operator_registration_active_guest_phone_unique` | MR-P0-003 | Operator registration active guest phone unique |
| `20260721100000_portal_member_plans_bp7` | MR-P0-003 | Portal member plans (BP-7); required intermediate |
| `20260721120000_tour_create_drop_tenants_select_bandage` | MR-P0-003 | Tour `CREATE`/`DROP` tenants SELECT bandage |
| `20260802140000_tenant_routes_tours_app_tour_grants` | Booking HTTP PG | `app_cloud` GRANT on `tenant_routes` + `tours` |
| `20260802150000_urban_registrations_app_tour_grants` | Booking HTTP PG / TODO-002 | Unconditional `app_cloud` GRANT on `urban_registrations` |
| `20260803120000_http_idempotency_app_cloud_grants` | Phase 5 / ci:integrity | Unconditional `app_cloud` GRANT on `http_idempotency_records` |
| `20260807120000_operator_registration_departure_keyset_index` | Bookings ops | Departure keyset index |
| `20260809120000_finance_refunds` | Finance | Durable finance refunds + RLS |
| `20260810120000_operator_registration_active_self_unique` | Denali self/other | Replace submitter-wide unique with self-only partial unique |
| `20260820130000_operator_pending_invite_expires_at` | User stack P1.2 | `operator_pending_invites.expires_at` NOT NULL (7-day backfill) |
| `20260820140000_finance_commercial_quotes` | CQ-1C | `finance_commercial_quotes` version chain + tenant RLS + `app_tour` DML |
| `20260820150000_finance_commercial_quote_member_discount` | CQ-2C | Member-discount provenance columns on quote versions |

Current head: **`20260820150000_finance_commercial_quote_member_discount`** — must move in lockstep with `prisma/migrations/`.

**Why this tip:** Prisma folder order is lexicographic. User + Finance + Discount landed three folders after `active_self_unique`. Tip is the last of that chain (`member_discount` columns on `finance_commercial_quotes`). Skipping the bump left `EXPECTED_PRISMA_MIGRATION_HEAD` at `20260810120000_operator_registration_active_self_unique` while the tip folder was `20260820150000_*` — `guard:migration-head-preflight` FAIL (MR-P0-003) and `booking-postgres-gate` red.

**Self-unique stays required, not tip:** Denali still needs `20260810120000_operator_registration_active_self_unique` applied on production (one booker, many `other` guests). That folder name moves into `REQUIRED_PRISMA_MIGRATION_NAMES` as an intermediate so boot still fails if that uniqueness migration is missing even when a later tip row exists. See [registration-self-other-uniqueness.mdoc](../../workspaces/denali/registration-self-other-uniqueness.mdoc).

**Quote table contract (tip chain):** `20260820140000` creates immutable quote versions (`tenant_id`, `registration_id`, `version_number` unique) with FORCE RLS. `20260820150000` adds nullable provenance: `member_discount_percentage_applied`, `member_discount_minor`, `member_discount_member_user_id`, `member_discount_membership_reference`. Production that has the table but not the discount columns would still mismatch the embedded tip. See [commercial-quote-snapshot.mdoc](../../workspaces/denali/commercial-quote-snapshot.mdoc).

`REQUIRED_PRISMA_MIGRATION_NAMES` must include prior intermediates that production probes still require (e.g. phone unique + portal member plans + self-unique + invite TTL + commercial quotes table) **and** the tip folder name. Bump both the tip constant and the required list in the same PR as any new migration folder (MASTER `MR-P0-003`).

**CI:** `booking-postgres-gate` runs `guard:migration-head-preflight` before migrate so a stale constant fails the release path (MASTER `MR-P0-003`).

## Verification

```bash
cd apps/api && pnpm run guard:migration-head-preflight
node --import tsx --test src/db/migration-head-preflight.spec.ts
```
