# Phase 4.2 → 4.3 Transition — Formal Integrity Audit (Ground Truth)

```yaml
audit_type: formal_integrity_audit
date: "2026-06-04"
auditor_role: lead_architect
branch: feat/phase-4
head_sha: "2017194177b3de7aafcf70b4b04ea7c0ee59e1cd"
head_subject: "docs(phase-4): finalize closure sign-off, gate artifact, and audit archive"
ledger_source: docs/phase-4/audits/IMPLEMENTATION-TRUTH.md
gate_artifact: reports/phase-4-gate-2026-06-04.json
live_db_profile: docs/phase-4/dev/docker-compose.yml
live_db_port: 5434
live_db_name: tour_db
proceed_gate: "Human must type PROCEED before any Subphase 4.3 implementation commits"
```

---

## 1. Executive verdict

| Question                                             | Answer                                                                                                                                                                                                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **May 4.3 implementation begin (per ledger rules)?** | **Guard yes, ledger no** — Subphase **4.2 operational proof** is **GREEN** (`p4_rls_integration_tests` PASS on live Postgres 5434). **IMPLEMENTATION-TRUTH** still lists **0/7 VERIFIED**; ledger rows for **4.2** are **stale** vs binding gate JSON. |
| **Is live RLS active on `tours`?**                   | **YES** — `tenant_isolation` policy, RLS enabled + forced (see §3).                                                                                                                                                                                    |
| **Mock DB for 4.3?**                                 | **FORBIDDEN** — all verification on Docker Postgres 5434 (see §4).                                                                                                                                                                                     |
| **Working tree vs HEAD**                             | **DRIFT** — uncommitted 4.3 artifacts exist locally; **not** in `HEAD` (see §2).                                                                                                                                                                       |

**Recommendation:** Treat this document + fresh `phase-4:guard` on 5434 as the **4.2→4.3 baseline**. Update **IMPLEMENTATION-TRUTH** row **4.2** to **VERIFIED** after human review. Do **not** commit 4.3 work until operator types **`PROCEED`**.

---

## 2. Snapshot analysis — `feat/phase-4` vs IMPLEMENTATION-TRUTH

### 2.1 Git snapshot

| Field        | Value                                                                                                                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch       | `feat/phase-4`                                                                                                                                                                                                            |
| `HEAD`       | `2017194`                                                                                                                                                                                                                 |
| Working tree | Dirty — includes **untracked/uncommitted** Phase 5 docs, **and** local 4.3 paths: `apps/api/src/internal/*`, `apps/api/scripts/db-seed.ts`, `apps/api/test/4.3-provisioning.spec.ts`, `apps/api/package.json` (`db:seed`) |

**Ground truth for “before 4.3 code” at `HEAD`:** No `apps/api/src/internal/provisioning.service.ts` in `HEAD`. Any 4.3 files on disk are **post-baseline local work**, not pinned to `2017194`.

### 2.2 Subphase ledger (per IMPLEMENTATION-TRUTH.md)

| Subphase | Ledger status | VERIFIED?       | Binding gate / repo signal                                                                                         |
| -------- | ------------- | --------------- | ------------------------------------------------------------------------------------------------------------------ |
| **4.0**  | PARTIAL       | **No**          | `p4_red_flag_prerequisite` PASS; red-flag report exists; human signoff / track `prove_with` not ledger-VERIFIED    |
| **4.1**  | PARTIAL       | **No**          | `p4_tenant_kernel_*`, `p4_contract_spec` PASS                                                                      |
| **4.2**  | PARTIAL       | **No** (ledger) | **Operational proof PASS** — `p4_rls_integration_tests`, `p4_anti_hollow_tests` (see §5); ledger gap text outdated |
| **4.3**  | PARTIAL       | **No**          | At `HEAD`: only `tenant-security.spec.ts` via guard bundle; MAP 4.3 seed/provision **not** in `HEAD`               |
| **4.4**  | PARTIAL       | **No**          | API `tenant-config.spec.ts`; TH-1 web e2e not VERIFIED                                                             |
| **4.5**  | PARTIAL       | **No**          | `p4_platform_events_*` PASS; full Postgres-path TourCreated integration not ledger-VERIFIED                        |
| **4.6**  | SPEC_ONLY     | **No**          | Requires all 4.0–4.5 VERIFIED + `phase-4:gate` closure narrative                                                   |

**VERIFIED count (ledger):** **0 / 7** subphases  
**PARTIAL count:** **6 / 7** (4.0–4.5)  
**SPEC_ONLY:** **4.6**

### 2.3 P4-E mechanism ledger (all PARTIAL or SPEC_ONLY per doc)

| P4-E           | Ledger    | Notes                                                                     |
| -------------- | --------- | ------------------------------------------------------------------------- |
| P4-E-RLS-01    | PARTIAL   | **Contradiction:** guard `p4_rls_integration_tests` **PASS** on 5434 (§5) |
| P4-E-TENANT-01 | PARTIAL   | Exercised inside same guard spawn as RLS integration                      |
| P4-E-GATE      | SPEC_ONLY | Full `phase-4:gate` chain separate from guard-only proof                  |
| _(others)_     | PARTIAL   | See IMPLEMENTATION-TRUTH.md § P4-E-\* table                               |

### 2.4 Ledger drift (action item, not 4.3 code)

[`IMPLEMENTATION-TRUTH.md`](../docs/phase-4/audits/IMPLEMENTATION-TRUTH.md) `last_guard` block claims `ok: true` and `p4_rls_integration_tests: PASS`, but subphase **4.2** row still lists gap _“`p4_rls_integration_tests` + CI DATABASE_URL”_. **Ground truth:** operational proof satisfied when env from [`docs/phase-4/ci.md`](../docs/phase-4/ci.md) is set; ledger row should be reconciled to **VERIFIED** after human signoff.

---

## 3. RLS verification — live database (port 5434)

**Method:** Direct `psql` against `postgresql://postgres:postgres@localhost:5434/tour_db` — **not** documentation.

**Container:** `app-tour-phase4-postgres` — Up (healthy).

### 3.1 Table `tours` — RLS flags

| `relname` | `rls_enabled` | `rls_forced` |
| --------- | ------------- | ------------ |
| `tours`   | **true**      | **true**     |

### 3.2 Policy `tenant_isolation`

| `polname`          | `polpermissive` | `using_expr`                                                       | `with_check_expr` |
| ------------------ | --------------- | ------------------------------------------------------------------ | ----------------- |
| `tenant_isolation` | permissive      | `tenant_id = current_setting('app.current_tenant_id', true)::uuid` | same              |

**Conclusion:** Production-intent RLS is **active and forced** on the real `tours` table used by Prisma (`canonical_data` column per migration).

### 3.3 Data snapshot (informational)

At audit time: **8** `tenants` rows (mostly `rls-a-*` / `rls-b-*` integration leftovers), **2** `tours` rows. **`tenant-a` / `tenant-b` MAP 4.3 seeds were not present** in this DB snapshot — expected before 4.3 seeding; does not invalidate RLS policy presence.

---

## 4. The “No-Mock” rule (4.3 and onward)

Phase 4 tenant security is defined as **Pool + RLS on real Postgres**, not in-memory tour storage.

| Rule                 | Rationale                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No mock database** | `InMemoryTourRepository` cannot exercise `tenant_isolation`, `FORCE ROW LEVEL SECURITY`, or `set_config('app.current_tenant_id', …)`. A mock would give false confidence for MAP 4.3 cross-tenant reads. |
| **Binding stack**    | `docs/phase-4/dev/docker-compose.yml` → port **5434** → role **`app_tour`** (NOBYPASSRLS) for tests; **`postgres`** admin for migrate/seed only.                                                         |
| **Guard contract**   | `p4_rls_integration_tests` spawns `rls-isolation.integration.spec.ts` + `tenant-security.spec.ts` with `DATABASE_URL` + `STORAGE_DRIVER=prisma` — fails closed if env unset.                             |
| **Application path** | Tour I/O must use `withTenantRls` / `PrismaTourRepository` — bypassing this invalidates 4.3 verification.                                                                                                |

**Architect acknowledgment:** All 4.3 verification steps in this program use the **live Docker Compose PostgreSQL** instance, not mocks, unless explicitly scoped to unit tests that do not assert RLS (e.g. host-parse in `tenant-kernel`).

---

## 5. Dependency check — Subphase 4.2 operational proof

**Required for 4.3 (DAG):** 4.2 DoD includes RLS integration green ([`SUBPHASE-READY-SPEC.md`](../docs/phase-4/audits/SUBPHASE-READY-SPEC.md)).

### 5.1 Binding check: `p4_rls_integration_tests`

| Source                                                                 | Result                                            | Timestamp                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| [`reports/phase-4-gate-2026-06-04.json`](phase-4-gate-2026-06-04.json) | `"ok": true`, `p4_rls_integration_tests.ok: true` | `gitSha` in file: `2017194`                                                                                            |
| **Fresh audit run**                                                    | **PASS**                                          | 2026-06-04 — `pnpm run phase-4:guard` with `DATABASE_URL=...@localhost:5434/tour_db`, `STORAGE_DRIVER=prisma`, Node 24 |

**4.2 operational proof (guard scope): PASS**

### 5.2 Full 4.2 DoD vs guard-only

| 4.2 exit criterion              | Guard proves? | Notes                                   |
| ------------------------------- | ------------- | --------------------------------------- |
| RLS integration (P4-E-RLS-01)   | **Yes**       | `p4_rls_integration_tests`              |
| Anti-hollow                     | **Yes**       | `p4_anti_hollow_tests`                  |
| Restart survival (P4-E-DATA-01) | **No**        | Separate spec; not in `p4_*` matrix     |
| Prisma + compose + SQL files    | **Partial**   | `p4_infra_compose` = file presence only |

**Ground truth:** **4.3 may proceed on RLS operational proof** per guard; full **4.2 VERIFIED** in ledger still needs restart-survival + ledger update. **4.6** still requires full `pnpm run phase-4:gate` (build + test + `phase-3:gate` + guard).

---

## 6. Transition gate — PROCEED

| Status                  | Detail                                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Audit complete**      | This file is the pinned baseline.                                                                                                                         |
| **4.3 coding**          | **BLOCKED** until operator types **`PROCEED`** in chat.                                                                                                   |
| **Pre-PROCEED hygiene** | (1) Reconcile IMPLEMENTATION-TRUTH 4.2 row. (2) Decide fate of uncommitted 4.3 local files vs clean `HEAD`. (3) Run `db:seed` on 5434 only after PROCEED. |

---

## 7. Sign-off block

| Role                   | Name         | Date       | Notes                                     |
| ---------------------- | ------------ | ---------- | ----------------------------------------- |
| Lead Architect (audit) | AI audit run | 2026-06-04 | Live RLS + guard re-run                   |
| Human operator         | _pending_    |            | Type **PROCEED** to authorize 4.3 commits |

---

_Architect, documentation status: Updated. Ground truth baseline: this file (`reports/phase-4-42-43-ground-truth-audit-2026-06-04.md`)._
