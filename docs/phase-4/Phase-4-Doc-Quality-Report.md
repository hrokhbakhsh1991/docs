# Phase 4 — Documentation Quality Report (Enterprise Multi-Tenant Architecture)

```yaml
report_meta:
  date: "2026-06-04"
  auditor_role: Senior System Architect / AI-Automation Specialist
  scope:
    - docs/phase-4/** (49 files)
    - docs/phase-4-tenant-kernel.md | .mdoc | .ai-exec.md
    - docs/MIGRATION-MAP.md (§7 tenant isolation, §11 phase 4 row, §12 gate rules)
    - cross: appendices/workspace-interoperability-model.md, phase-handoff-3-4-5.md, audits/*
  code_spot_check:
    - apps/api/src/tenant-kernel/
    - packages/tenant-kernel/
    - apps/web/app/layout.tsx
    - apps/api/src/workspace/
  method: Full doc corpus read + IMPLEMENTATION-TRUTH + gate JSON + selective repo truth
  not_in_scope: .cursor/plans/ (unchanged)
```

---

## Executive summary

Phase 4 documentation is **among the strongest phase packs in the repo** for AI cold-start: a single execution SoT ([`phase-4-ai-exec.md`](phase-4-ai-exec.md)), tiered load policy, YAML subphases 4.0–4.6 with `completion_proof`, explicit tenant ≠ workspace interoperability, and honest dual scoring (doc navigation vs repo closure). Enterprise multi-tenancy intent (pool + RLS, CASL + RLS, host-first resolution, silo deferred to Phase 7) is architecturally coherent with Phases 0–3 and [`MIGRATION-MAP.md`](../../MIGRATION-MAP.md) §7/§11.

**Critical gap:** closure mechanics **under-bind** several P4-E claims. `phase-4:guard` runs package build/tests and file presence—not `apps/api` RLS integration, tenant-security, or TH-1 web e2e—while [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) marks 4.1/4.5 **VERIFIED** and internal reports claim **doc 100** even though [`reports/phase-4-gate-2026-06-04.json`](../../reports/phase-4-gate-2026-06-04.json) shows `ok: false` (build/test failures). An agent or team implementing literally from “PASS” doc audits without `phase-4:gate` on Node 24 risks **gate theater** and production paths still defaulting to in-memory storage in non-production environments.

**Overall weighted score: 78%** — excellent specification density, moderate enterprise runtime proof binding, execution honesty ~29% (2/7 subphases VERIFIED per IMPLEMENTATION-TRUTH).

---

## Compliance score table

| Category | Score | Rationale (evidence) |
|----------|------:|----------------------|
| **1. Architectural cohesion** | **84%** | [`appendices/workspace-interoperability-model.md`](appendices/workspace-interoperability-model.md), monolith §0 import matrix, `platform-core` ↛ `tenant-kernel` (grep clean). Minor drift: MAP §3.5 three-app narrative vs single `apps/web` shell; Phase 5-era `resolve-workspace-type.ts` in API while 4.3 still lists optional plugin work. |
| **2. AI-readiness & contextual clarity** | **87%** | `AGENT_START_SEQUENCE`, T0 forbid overview/monolith, [`appendices/knowledge-index.md`](appendices/knowledge-index.md), all subphases `machine_readable` + `completion_proof`. Deductions: no in-repo Ambiguity Log until this report; per-step `failure_condition` thin outside P4-E table; stub/index/hub triple entry. |
| **3. Enterprise-grade multi-tenancy** | **79%** | Pool+RLS, `SET LOCAL`, tenant from host/JWT explicit in overview §2 and MAP §7. Deductions: guard omits DB/integration proofs; Redis “scaffold” not gated; no concurrency/pool soak; dev default `STORAGE_DRIVER` → memory ([`create-tour-storage.ts`](../../apps/api/src/storage/create-tour-storage.ts)). |
| **4. Actionable implementation logic** | **82%** | `4.x-Sn` steps, [`audits/SUBPHASE-READY-SPEC.md`](audits/SUBPHASE-READY-SPEC.md) DoR/DoD, P4-E `FAIL_if` in [`phase-4-enforcement.md`](phase-4-enforcement.md). Deductions: prose `prove_with` lines; 4.3 `optional_after_4_3`; P4-E-SCALE-01 allows doc-only Big-O; observability non-gating. |
| **Overall (weighted)** | **78%** | 25% each category; reflects doc excellence + repo/proof gap (GAP register, gate JSON). |

*Internal doc self-scores (README “doc 100 / execution 29”) are directionally correct; this report treats **closure** as 60% weight in the overall narrative.*

---

## Ambiguity log

| Location | Quote / snippet | Why unclear for AI | Suggested fix |
|----------|-----------------|-------------------|---------------|
| [`subphases/4.4-tenant-theme.md`](subphases/4.4-tenant-theme.md) `api.route` | `GET /api/v2/tenant-config OR GET /tenant/theme` | Two canonical routes; agents may implement both or wrong one. | Pick one path; deprecate other in `test-matrix` + OpenAPI stub. |
| [`subphases/4.3-provisioning.md`](subphases/4.3-provisioning.md) `optional_after_4_3` | `resolve pluginId from header registry … closes RF-F03` | Optional vs required for 4.3 DoD; reads like unscoped research. | Move to Phase 5.2/6 with P5-E id or mark `DEFERRED` in forbidden list. |
| [`subphases/4.0-gate-of-gates.md`](subphases/4.0-gate-of-gates.md) R1/R3 `prove` | `"apps/web layout force-dynamic + per-request session"` / `"web POST /tours server action integration"` | Not executable commands; no `FAIL_if` per track. | Add `pnpm exec vitest …` paths or Playwright id; mirror R0 test file pattern. |
| [`subphases/4.2-postgres-rls.md`](subphases/4.2-postgres-rls.md) `prove_with` | `"restart survival test P4-E-DATA-01"` | No script name; agent cannot run without inventing test. | Add exact test file + env block in [`appendices/env-runtime-matrix.md`](appendices/env-runtime-matrix.md). |
| [`phase-4-enforcement.md`](phase-4-enforcement.md) P4-E-SCALE-01 | `mechanism: [repository spec, doc Big-O]` | Doc-only path can satisfy enforcement without code proof. | Require assertion in `in-memory-tour.repository.spec.ts` only; remove “doc Big-O” as mechanism. |
| [`README.md`](README.md) + [`AI-READABILITY-REPORT.md`](AI-READABILITY-REPORT.md) | `doc 100` vs `execution 29` | Agents may stop after navigation score. | Keep dual score but add **FAIL** rule in `phase-4-ai-exec.md`: forbid marking phase closed if `doc_composite_pre_code` used as closure. |
| [`reports/phase-3.2-red-flag-status-2026-06-04.md`](../../reports/phase-3.2-red-flag-status-2026-06-04.md) | Tracks **PASS** + `phase_4_0_human_signoff: false` | Guard passes on file existence only; contradicts 4.0 PARTIAL ledger. | Guard optional second check: YAML `phase_4_0_human_signoff: true` or CI job re-runs `prove_with`. |
| [`MIGRATION-MAP.md`](../../MIGRATION-MAP.md) §3.5 vs [`phase-4-tenant-kernel.md`](../../phase-4-tenant-kernel.md) §0.1 | Three apps vs one `apps/web` | Cold-start agents may scaffold wrong app topology. | Single “Phase 4 runtime = apps/web” callout in MAP §3.5 footnote. |
| [`appendices/observability.md`](appendices/observability.md) (via enforcement) | `RECOMMENDED_NOT_GATING` | Enterprise ops may assume logs/metrics required. | Label `ASPIRATIONAL` in SUBPHASE-READY-SPEC; link Phase 7 MAP §10. |
| [`apps/api/src/tenant/resolve-workspace-type.ts`](../../apps/api/src/tenant/resolve-workspace-type.ts) comment | “validation-time plugin resolution (5.2)” | Phase boundary blur vs 4.3 optional plugin line. | Document in [`phase-handoff-3-4-5.md`](appendices/phase-handoff-3-4-5.md) as Phase 5 early wiring exception. |

---

## Operational risks

Implementing Phase 4 **literally from doc PASS rows without repo gates** risks:

| Risk | Doc source | If implemented literally |
|------|------------|---------------------------|
| **In-memory production SoT** | Dev unset `STORAGE_DRIVER` → memory ([`storage-driver-truth.md`](appendices/storage-driver-truth.md)) | Tours lost on restart; violates P4-E-DATA-01 intent in staging/dev clusters mis-labeled non-production. |
| **RLS theater** | P4-E-RLS-01 mechanism = integration spec; guard only anti-hollow scan ([`phase-4-guard.md`](phase-4-guard.md)) | Merge with green `p4_anti_hollow_tests` while Docker/DB down; cross-tenant read possible if CASL bypassed. |
| **False 4.0 closure** | Red-flag report exists → `p4_red_flag_prerequisite` PASS | 4.1+ merge while R1/R3 proofs are narrative-only. |
| **Theme parity gap** | 4.4 has no P4-E-*; guard does not run TH-1 | Tenant B sees tenant A accent in production UI. |
| **Connection pool session leak** | P4-E-RLS-02 “unit mock pool” only in enforcement table | High-concurrency pool reuse without TX-scoped `set_config` → cross-tenant bleed under load. |
| **Pre-commit false confidence** | [`ci.md`](ci.md): Husky does not run `phase-4:gate` | Commits land without tenant package build/test until manual PR step. |
| **Workspace before tenant** | Optional 4.3 plugin header resolution | Plugin rules applied before verified `tenantId` if mis-ordered in middleware. |

---

## Refinement priority

### P0 — rewrite before broad coding / merge

1. **[`ci.md`](ci.md) + [`phase-4-guard.md`](phase-4-guard.md) + [`audits/verification-matrix.md`](audits/verification-matrix.md)** — Align guard with P4-E: run (or gate-skip with explicit waiver) `apps/api/test/rls-isolation.integration.spec.ts`, `tenant-security.spec.ts`, and document DATABASE_URL + `STORAGE_DRIVER=prisma` for 4.2 CI job. *Evidence:* guard JSON has no API test invocations; IMPLEMENTATION-TRUTH marks P4-E-RLS-01 PARTIAL.
2. **[`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) + [`README.md`](README.md)** — Reconcile **VERIFIED** rows with [`reports/phase-4-gate-2026-06-04.json`](../../reports/phase-4-gate-2026-06-04.json) (`ok: false` on build/test). Require gate `ok: true` before any subphase VERIFIED.
3. **[`subphases/4.4-tenant-theme.md`](subphases/4.4-tenant-theme.md) + [`appendices/test-matrix.md`](appendices/test-matrix.md)** — Single API route; bind TH-1 to `pnpm` command in `prove_with` (Playwright or vitest path).
4. **[`subphases/4.0-gate-of-gates.md`](subphases/4.0-gate-of-gates.md)** — Replace prose `prove` with command lines + per-track `FAIL_if` (mirror P4-E pattern).

### P1 — next doc sprint

5. **[`appendices/env-runtime-matrix.md`](appendices/env-runtime-matrix.md)** — Mandatory env block for 4.2/4.3 CI: `DATABASE_URL`, `STORAGE_DRIVER=prisma`, compose up.
6. **[`MIGRATION-MAP.md`](../../MIGRATION-MAP.md) §3.5** — Footnote: Phase 4 implements `apps/web` only; three-app deploy is post-4.
7. **[`phase-4-enforcement.md`](phase-4-enforcement.md)** — Remove doc-only path for P4-E-SCALE-01; add `FAIL_if` for missing integration in guard.
8. **[`subphases/4.3-provisioning.md`](subphases/4.3-provisioning.md)** — Delete or defer `optional_after_4_3` to Phase 5/6 registry.

### P2 — polish

9. **[`appendices/observability.md`](appendices/observability.md)** — Enterprise SRE appendix: what is deferred to Phase 7 vs 4.x scaffold.
10. **[`phase-4-tenant-kernel.md`](../../phase-4-tenant-kernel.md)** — Trim duplicate DAG prose; point to modular subphases only (T3 already flagged).

---

## Cross-phase invariant checklist

| Invariant | Result | Evidence |
|-----------|--------|----------|
| `platform-core` → `workspace-sdk` only; no tenant-kernel import | **PASS** | No matches under `packages/platform-core` for tenant-kernel |
| `workspace-sdk` ↛ `workspaces/*` | **PASS** | Stated in monolith §0.3; Phase 3 guards (nested in `phase-4:gate` step 3) |
| `apps/web` ↛ static `workspaces/*` | **PASS** | Monolith + interoperability forbidden list |
| `tenant-kernel` ↛ `workspaces/*`, ↛ `platform-core` | **PASS** | [`subphases/4.1-tenant-kernel.md`](subphases/4.1-tenant-kernel.md) `import_boundary` |
| `apps/api` → tenant-kernel, not inverse in package | **PASS** | Adapter in `apps/api/src/tenant-kernel/`; exports in `packages/tenant-kernel/src/index.ts` |
| UI subpaths only (`ui-primitives/*`) | **PASS** | Phase 2/3 unchanged; 4.4 uses theme chain |
| CASL before RLS; RLS not sole authz | **PASS** | [`workspace-interoperability-model.md`](appendices/workspace-interoperability-model.md); forbidden RLS-only |
| Phase 3 in-memory ≠ Phase 4 Postgres SoT | **PARTIAL** | Documented in storage-driver-truth; **code** defaults memory when unset + non-production |
| Tenant resolve before workspace plugin | **PASS** (doc) / **PARTIAL** (code) | Interop diagram; `resolveWorkspacePluginForType` after tenant context in tours path — verify middleware order in API (out of spot-check depth) |
| No outbox / `canonical_data` rename in Phase 4 | **PASS** | [`phase-4-enforcement.md`](phase-4-enforcement.md) `forbidden_phase_4` |
| `phase-3:gate` before Phase 4 closure | **PASS** | [`ci.md`](ci.md) step 3 in `phase-4:gate` |
| Doc-first covenant for protected packages | **PASS** | `.cursorrules`; subphases reference docs paths |

---

## Subphase coverage matrix (4.0–4.6)

| Subphase | AI exec plan | Actionable gate | DoD (explicit) | Failure conditions | Notes |
|----------|:------------:|:---------------:|:--------------:|:------------------:|-------|
| **4.0** | Via [`phase-4-ai-exec.md`](phase-4-ai-exec.md) + [`4.0-gate-of-gates.md`](subphases/4.0-gate-of-gates.md) | `p4_red_flag_prerequisite` + track proofs | [`SUBPHASE-READY-SPEC`](audits/SUBPHASE-READY-SPEC.md) + `exit_criteria_4_0` | P4-E `FAIL_if` for R0 only; R1–R3 narrative | Report exists; ledger **PARTIAL** |
| **4.1** | Yes | `p4_tenant_kernel_*`, `p4_contract_spec` | DoR/DoD + `exit_criteria_4_1` | P4-E-HOST-01, P4-E-RLS-02 `FAIL_if` | Ledger **VERIFIED**; gate JSON build **FAIL** |
| **4.2** | Yes | Commands in subphase; **not** in guard | DoD in ready-spec | P4-E-RLS/DATA `FAIL_if` | Integration spec exists; guard does not run it |
| **4.3** | Yes | `tenant-security.spec.ts` (doc); **not** in guard | `exit_criteria_4_3` | P4-E-TENANT-01 `FAIL_if` | “two-tenant e2e” prose only |
| **4.4** | Yes | TH-1 matrix; **no** P4-E id | DOD-7 | Implicit via TH-1 scenario | Route OR ambiguous |
| **4.5** | Yes | `p4_platform_events_*` | `exit_criteria_4_5` | P4-E-EVT-01 `FAIL_if` | Ledger **VERIFIED**; gate build **FAIL** in JSON |
| **4.6** | Yes | `pnpm run phase-4:gate` | CLOSURE-CHECKLIST + DOD-9–12 | P4-E-GATE `FAIL_if` | **SPEC_ONLY** until 4.0–4.5 VERIFIED |

**AI execution plan SoT:** There is no separate file named “AI Execution Plan” per subphase; the **plan is the subphase YAML + router** [`phase-4-ai-exec.md`](phase-4-ai-exec.md) `ACTION — Subphase execution`. Cold start: [`phase-4-tenant-kernel.ai-exec.md`](../phase-4-tenant-kernel.ai-exec.md) → router only.

---

## Doc–code drift (spot-check)

| Doc claim | Repo observation | Severity |
|-----------|------------------|----------|
| 4.1 package exports host + RLS constants | Matches [`packages/tenant-kernel/src/index.ts`](../../packages/tenant-kernel/src/index.ts) | OK |
| JWT/auth stay in `apps/api/src/tenant-kernel` | Matches subphase `NOT_in_package_until_extracted` | OK |
| `layout.tsx` force-dynamic + per-request theme | [`apps/web/app/layout.tsx`](../../apps/web/app/layout.tsx) `dynamic = 'force-dynamic'`, `fetchTenantThemeForContext` | OK |
| `resolveWorkspacePluginForType` from workspace_type | [`apps/api/src/workspace/resolve-workspace-plugin.ts`](../../apps/api/src/workspace/resolve-workspace-plugin.ts) | OK (aligns 4.3 `workspace_type`) |
| Default runtime Prisma when DATABASE_URL (4.2) | [`create-tour-storage.ts`](../../apps/api/src/storage/create-tour-storage.ts): unset → memory unless `NODE_ENV=production` | **DRIFT** vs 4.2 “dev SoT must set prisma” |
| `phase-4:guard` proves RLS isolation | Guard runs anti-hollow only; no `docker compose` / integration spawn | **DRIFT** |
| Gate green / 4.1 VERIFIED | `phase-4-gate-2026-06-04.json` `ok: false` | **DRIFT** |
| `infra/sql/001_tenant_rls.sql` | Present under `infra/sql/` | OK |
| Phase 5 SQL not before 4.6 | `002_phase5_data_layer.sql` exists (untracked in git status) — handoff doc warns order | Watch merge discipline |

---

## Top references (agent cold start)

1. [`phase-4-ai-exec.md`](phase-4-ai-exec.md) — sole execution entry  
2. [`subphases/{4.0–4.6}.md`](subphases/) — steps + `completion_proof`  
3. [`audits/IMPLEMENTATION-TRUTH.md`](audits/IMPLEMENTATION-TRUTH.md) — repo honesty ledger  
4. [`appendices/workspace-interoperability-model.md`](appendices/workspace-interoperability-model.md) — tenant ≠ workspace  
5. [`phase-4-enforcement.md`](phase-4-enforcement.md) — P4-E `FAIL_if` + phase DoD  
6. [`ci.md`](ci.md) + [`reports/phase-4-gate-*.json`](../../reports/) — binding closure  

---

## Summary for parent agent

| Item | Value |
|------|-------|
| **Overall score** | **78%** |
| **Top 3 P0 doc fixes** | (1) Bind guard/CI to API integration tests + prisma env matrix (2) Fix IMPLEMENTATION-TRUTH vs gate JSON honesty (3) Canonicalize 4.4 route + executable TH-1 `prove_with` |
| **Report path** | [`docs/phase-4/Phase-4-Doc-Quality-Report.md`](Phase-4-Doc-Quality-Report.md) |

---

---

## Gate failure log (post-hardening)

**Run:** `pnpm run phase-4:gate` on Node **v24.16.0** (2026-06-04, post RLS guard + doc hardening).

| Step | Result |
|------|--------|
| `pnpm build` | PASS |
| `pnpm test` | PASS (RLS integration suite **skipped** in workspace test — no `DATABASE_URL`) |
| `pnpm run phase-3:gate` | PASS |
| `pnpm run phase-4:guard` | **FAIL** exit 1 |

**Binding report:** [`reports/phase-4-gate-2026-06-04.json`](../../reports/phase-4-gate-2026-06-04.json) — `ok: false`, `gitSha: 1937f0b`.

| Check | ok | detail |
|-------|----|--------|
| `p4_red_flag_prerequisite` | true | — |
| `p4_tenant_kernel_build` | true | — |
| `p4_tenant_kernel_test` | true | — |
| `p4_platform_events_build` | true | — |
| `p4_platform_events_test` | true | — |
| `p4_contract_spec` | true | — |
| `p4_no_denali_in_kernel` | true | — |
| `p4_infra_compose` | true | — |
| **`p4_rls_integration_tests`** | **false** (pre-setup) | `DATABASE_URL unset` |
| `p4_anti_hollow_tests` | true | — |

### Gate run log (post local Postgres setup — 2026-06-04)

**Command:** `pnpm run phase-4:gate` on Node **24.16.0**  
**Exit code:** **0** (all `p4_*` PASS including `p4_rls_integration_tests`)

**Environment used (host port 5434 — 5432 was already bound on this machine):**

```bash
docker compose -f docs/phase-4/dev/docker-compose.yml up -d
export DATABASE_URL="postgresql://app_tour:app_tour@localhost:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@localhost:5434/tour_db"
export STORAGE_DRIVER=prisma
pnpm --filter @apps/api exec prisma migrate dev --name phase4_schema
psql "$DATABASE_URL_ADMIN" -f infra/sql/001_tenant_rls.sql
pnpm run phase-4:gate
```

**Code paths added for RLS + Prisma pool:** `apps/api/src/db/with-tenant-rls.ts`, `PrismaTourRepository` transaction-scoped `set_config`, `DATABASE_URL_ADMIN` for CASL `resolveById`.

**If your machine uses port 5432:** set `PHASE4_DB_PORT=5432` in compose and use `postgresql://postgres:postgres@localhost:5432/tour_db` for admin migrate; use `app_tour` URL for gate (not `postgres` — superuser bypasses RLS).

**Hardening applied this sprint:** `p4_rls_integration_tests` guard check; IMPLEMENTATION-TRUTH honesty; canonical `GET /api/v2/tenant-config`; [`ci.md`](ci.md) env block.

---

*Generated by Phase 4 documentation quality evaluation — 2026-06-04. Does not modify execution plans under `.cursor/plans/`.*
