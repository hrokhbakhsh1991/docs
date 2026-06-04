# Phase 4 — Subphase ready spec (DoR / DoD)

```yaml
spec_meta:
  date: "2026-06-04"
  agent_load_tier: T0_execution
  commands: ../appendices/p4-e-command-atlas.md
  tests: ../appendices/test-inventory.md
  env: ../appendices/env-runtime-matrix.md
```

---

## 4.0 — Gate of gates

| | |
|--|--|
| **DoR** | `pnpm run phase-3:gate` exit 0 |
| **DoD** | `reports/phase-3.2-red-flag-status-*.md` · R0–R3 tracks PASS · `p4_red_flag_prerequisite` ok |
| **Prove** | [`4.0-gate-of-gates.md`](../subphases/4.0-gate-of-gates.md) `completion_proof` |
| **Artifacts** | status report · auth-env spec · in-memory scale spec |
| **Forbidden** | merge 4.1+ without report file |

---

## 4.1 — tenant-kernel package

| | |
|--|--|
| **DoR** | 4.0 DoD |
| **DoD** | `@app-tour/tenant-kernel` build+test · `test:phase-4` · `TenantRoute` stub only · no Denali in package |
| **Prove** | `p4_tenant_kernel_*` + `p4_contract_spec` |
| **Files** | `packages/tenant-kernel/src/**` · `test/host-parse.spec.ts` · `test/phase-4.contract.spec.ts` |
| **Forbidden** | Nest/Prisma inside package · workspace plugin code |

---

## 4.2 — Postgres + RLS

| | |
|--|--|
| **DoR** | 4.1 DoD |
| **DoD** | `001_tenant_rls.sql` applied · Prisma schema synced · `STORAGE_DRIVER=prisma` path · RLS integration green · restart survival |
| **Prove** | P4-E-RLS-01, P4-E-DATA-01, P4-E-RLS-02, P4-E-SCALE-01 |
| **Files** | `infra/sql/001_tenant_rls.sql` · `apps/api/prisma/schema.prisma` · `test/rls-isolation.integration.spec.ts` |
| **Forbidden** | production default InMemory without waiver · raw SQL without tenant TX |

---

## 4.3 — Provisioning / two-tenant

| | |
|--|--|
| **DoR** | 4.2 DoD |
| **DoD** | seed `tenant-a` / `tenant-b` · `tenant-security.spec.ts` PASS · API routes reject missing tenant |
| **Prove** | P4-E-TENANT-01 |
| **Files** | `apps/api/test/tenant-security.spec.ts` · seed scripts per subphase |
| **Forbidden** | trust body `tenant_id` over auth header |

---

## 4.4 — Tenant theme (parallel)

| | |
|--|--|
| **DoR** | 4.2 DoD |
| **DoD** | TH-1: tenant-a `primaryColor` ≠ tenant-b · API tenant-config returns DB theme not mock |
| **Prove** | test-matrix TH-1 · `tenant-config.spec.ts` |
| **Files** | `apps/api/test/tenant-config.spec.ts` · `apps/web` TenantThemeProvider chain |
| **Forbidden** | skip 4.4 because no P4-E-* id · mock-only theme at 4.6 |

---

## 4.5 — In-process events (parallel)

| | |
|--|--|
| **DoR** | 4.2 DoD |
| **DoD** | `platform-events` build+test · TourCreated includes `tenantId` · hook from canonical write path |
| **Prove** | P4-E-EVT-01 |
| **Files** | `packages/platform-events/**` · `canonical-tour.service.events.spec.ts` |
| **Forbidden** | outbox table in Phase 4 · `publishDomainEvent` after Phase 5.4 without outbox |

---

## 4.6 — Gate + forensic

| | |
|--|--|
| **DoR** | 4.0–4.5 all DoD (incl. 4.4 TH-1) |
| **DoD** | `phase-4:gate` ok · `guard:doc-sync` · forensic mdoc verdict filled · IMPLEMENTATION-TRUTH 7/7 VERIFIED |
| **Prove** | [`CLOSURE-CHECKLIST.md`](CLOSURE-CHECKLIST.md) sections A–D |
| **Forbidden** | CONSISTENCY PASS as closure · guard-only without full gate |

---

## Parallelism reminder

```text
4.0 → 4.1 → 4.2 → 4.3
              ├→ 4.4 ∥ 4.5 → 4.6
```

4.4 and 4.5 both require **4.2**; 4.4 does **not** require 4.5.
