# Tour create × `tenants` FORCE RLS (FK connect)

```yaml
doc_id: TOUR_CREATE_TENANTS_RLS_FK
status: ACTIVE
related:
  - HOSTILE_AUDIT_REMEDIATION_2026-07-20.md
  - apps/api/prisma/migrations/20260720160000_hostile_audit_tenant_rls_closure
  - apps/api/src/canonical/atomic-canonical-tour-persist.ts
nano: PREV-AUD-002 / TODO-002 adjacency
```

## Symptom

Operator Denali wizard submit (`POST /tours` via BFF) returned **404 `RECORD_NOT_FOUND`** (Prisma `P2025`) after hostile-audit RLS landed, even when the Denali tenant row existed under `DATABASE_URL_ADMIN`.

## Root cause

1. Migration `20260720160000_hostile_audit_tenant_rls_closure` enables **FORCE RLS** on `tenants` with **no `app_cloud` policies** (intentional platform-catalog deny — mutations/reads via admin client only).
2. Atomic tour create built Prisma data as `TourCreateInput` with `tenant: { connect: { id } }`.
3. Prisma `connect` issues a **SELECT** on `tenants` under the `app_cloud` role. With FORCE RLS and zero policies, that SELECT is empty → **P2025** mapped to `RECORD_NOT_FOUND`.

This is **not** a missing seed by itself (seed may also be required on empty local DBs), and **not** a destination-catalog bug. The FK path is the contract break.

```text
                    FORCE RLS, no policy
   tenants ──────────────────────────────────┐
                                             │ SELECT for connect → deny/empty
                                             ▼
   buildTourCreateData → tenant: { connect } → P2025 RECORD_NOT_FOUND
                                             ▲
   tours RLS (tenant_id = GUC) ──────────────┘  INSERT never reached
```

## Correct model (architecture-preserving)

Keep the hostile-audit intent: **`tenants` remains admin-deny for `app_cloud`.**

Tour writes must use the **unchecked scalar FK**, same as `prisma-tour.repository.ts` create:

| Path | Shape | Needs SELECT on `tenants`? |
| ---- | ----- | -------------------------- |
| ❌ Legacy atomic | `TourCreateInput` + `tenant: { connect }` | Yes → breaks under deny |
| ✅ Canonical | `TourUncheckedCreateInput` + `tenantId` | No — DB FK still enforced |

PostgreSQL still validates `tours.tenant_id → tenants.id` on insert. RLS on `tours` continues to require `app.current_tenant_id` match via `withCanonicalTransaction` / `withTenantRls`.

**Do not** add a broad `SELECT` policy on `tenants` for `app_cloud` to “make connect work” — that re-opens a catalog table the hostile audit closed. A one-off local policy is a **dev bandage only**; the durable fix is the unchecked create payload.

## Dev ops (orthogonal)

Empty local Postgres still needs:

```bash
pnpm --filter @apps/api run db:seed
```

Without seed, admin can see zero fixed Denali UUID tenants; that is a separate failure mode from P2025-on-connect.

## Verification

- Source contract: atomic persist must not contain `tenant: { connect`.
- Integration paths that call `persistNewTourAtomically` under Prisma + RLS continue to create tours for seeded tenants.
- Ad-hoc policy `tenants_current_tenant_select` (if present from a live debug session) is dropped by follow-up migration — not required once unchecked create lands.

## Cross-links

- [HOSTILE_AUDIT_REMEDIATION_2026-07-20.md](./HOSTILE_AUDIT_REMEDIATION_2026-07-20.md) — RLS policy model
- [HOSTILE_AUDIT_REMEDIATION.md](./HOSTILE_AUDIT_REMEDIATION.md) — residual tracking
- Denali wizard smoke script: `apps/web/scripts/denali-create-mountain-day-tour.mjs` (searchable destination combobox)
