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
| `20260820130000_operator_pending_invite_expires_at` | Identity | Pending operator invite expiry |
| `20260820140000_finance_commercial_quotes` | Finance | Commercial quote persistence |
| `20260820150000_finance_commercial_quote_member_discount` | Finance | Commercial quote member-discount support |
| `20260821100000_operator_user_role_audit_app_tour_grants` | Identity / grants | Operator user-role audit grants |
| `20260824120000_dp1_payment_holds` | Wave B DP1 | Payment hold persistence |
| `20260826120000_workspace_tour_theme_icon_key` | Denali settings | Optional icon key for workspace tour themes |
| `20260905160000_operator_registration_attendance` | SDE-001 / attendance | Attendance columns on operator_registrations |
| `20260905170000_tour_execution_operations` | ITO-001 | Tour execution ops tables + RLS; current tip |

Current head: **`20260905170000_tour_execution_operations`** — must move in lockstep with `prisma/migrations/`.

**Why self-unique tip:** Denali allows one booker to register multiple `other` guests; legacy `uq_operator_reg_active_user` blocked that. See [registration-self-other-uniqueness.mdoc](../../workspaces/denali/registration-self-other-uniqueness.mdoc).

`REQUIRED_PRISMA_MIGRATION_NAMES` must include prior intermediates that production probes still require (e.g. phone unique + portal member plans) **and** the tip folder name. Bump both the tip constant and the required list in the same PR as any new migration folder (MASTER `MR-P0-003`).

**CI:** `booking-postgres-gate` runs `guard:migration-head-preflight` before migrate so a stale constant fails the release path (MASTER `MR-P0-003`).

## Verification

```bash
cd apps/api && pnpm run guard:migration-head-preflight
node --import tsx --test src/db/migration-head-preflight.spec.ts
```
