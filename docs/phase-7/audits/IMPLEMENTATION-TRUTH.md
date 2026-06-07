# Phase 7 — Implementation truth (honesty ledger)

```yaml
truth_version: "2026-06-07-v6"
repo_snapshot: "2026-06-07"
doc_pack: VERIFIED_SCAFFOLD
behavioral: PARTIAL_7_8
subphase_7_0: VERIFIED_ENTRY
subphase_7_3: VERIFIED_BEHAVIORAL
subphase_7_4: VERIFIED_BEHAVIORAL
subphase_7_5: VERIFIED_BEHAVIORAL
subphase_7_6: VERIFIED_BEHAVIORAL
subphase_7_7: VERIFIED_BEHAVIORAL
subphase_7_8: VERIFIED_BEHAVIORAL
entry_verified_at: "2026-06-07"
closure_git_sha: 4c8cc2e
```

> **Agents:** Read this before any Phase 7 implementation claim. **7.0–7.7** behavioral per specs below.

## Package status

| Path                          | Status                  | Notes                                    |
| ----------------------------- | ----------------------- | ---------------------------------------- |
| `packages/workspaces/urban`   | **PACKAGE_SHELL**       | 7.1 — registry + golden fixtures + theme |
| `packages/workspaces/denali`  | **VERIFIED_BEHAVIORAL** | Phase 6 closed (Tier D) — urban template |
| `packages/workspaces/starter` | **VERIFIED_BEHAVIORAL** | Reference pattern                        |
| `TenantConnectionRouter`      | **VERIFIED_BEHAVIORAL** | 7.7 — tenant-kernel + api lookup adapter |
| `tenant_routes` DDL           | **VERIFIED_BEHAVIORAL** | Prisma `*_tenant_routes` migration       |

## Apps status

| Concern                                  | Status                  | Subphase                                         |
| ---------------------------------------- | ----------------------- | ------------------------------------------------ |
| `resolveWorkspacePluginForType("urban")` | **VERIFIED_BEHAVIORAL** | 7.3 — api eager · web lazy-urban-plugin          |
| Urban HTTP create → publish E2E          | **VERIFIED_BEHAVIORAL** | 7.4 — `urban-create-publish.integration.spec.ts` |
| MAP §10 observability fields + runbook   | **VERIFIED_BEHAVIORAL** | 7.5 — `audit-log-fields.mjs` + request logging   |
| Redis rate limits per tenant + tier keys | **VERIFIED_BEHAVIORAL** | 7.6 — `rate-limit-tenant.spec.ts` (Redis)        |
| Tenant tier in logs + rate-limit keys    | **VERIFIED_BEHAVIORAL** | 7.7 — ALS `tenantTier` from router               |
| `phase-7.contract.spec.ts`               | **VERIFIED_BEHAVIORAL** | 7.2 genericity · baseline `64d9fea`              |
| ADVERSARIAL-MATRIX P0 (7.8)              | **VERIFIED_BEHAVIORAL** | `phase-7:adversarial-gate` + GHA `phase-7-gate`  |
| `rls-tenant-isolation.spec.ts`           | **VERIFIED_BEHAVIORAL** | ADV-P7-P0-01 — Postgres + migrate                |
| `rls-write-boundary.spec.ts`             | **VERIFIED_BEHAVIORAL** | ADV-P7-P0-02 — Postgres + migrate                |

## Deferred (honest)

| Item                         | Status       | Note                                               |
| ---------------------------- | ------------ | -------------------------------------------------- |
| Silo dedicated DB connection | **DEFERRED** | `withTenantRls` still uses pool `getPrisma()` only |
| `SET LOCAL search_path`      | **DEFERRED** | schema-per-tenant connect hook — post-7.7          |

## Phase 6 prerequisite

| Gate                   | Status (2026-06-07)                                              |
| ---------------------- | ---------------------------------------------------------------- |
| Phase 6 closure        | **PASS** — `phase_closed: true` · Tier D · forensic 10/10        |
| `phase-6:fast-closure` | **PASS** — 7.0 entry evidence (full `phase-6:gate` → CI nightly) |

## Blockers

See [`appendices/blockers.md`](../appendices/blockers.md).

| ID       | Status     | Note                                            |
| -------- | ---------- | ----------------------------------------------- |
| BL-P7-02 | **OPEN**   | `rate-limit-tenant.spec.ts` skips when no Redis |
| BL-P7-03 | **CLOSED** | `tenant_routes` migration landed in 7.7         |

## Doc vs repo

| Metric       | Doc pack | Repo behavioral       |
| ------------ | -------- | --------------------- |
| Score target | ≥96      | 7.1–7.8 closed (~65%) |

**Do not claim Platform DoD from documentation guard alone.**
