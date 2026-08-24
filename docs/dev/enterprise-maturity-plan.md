# Enterprise Maturity Plan — canonical MAT ledger

**Program:** Enterprise Maturity (post-Composable Workspace foundation)  
**Baseline:** CW foundation certified; profile + capabilities + workspacePolicy; tour-core boundaries; workspace isolation  
**Date:** 2026-08-24  
**Coordinator:** Enterprise Maturity Program

**Inputs:** `docs/dev/composable-workspace-refactor-plan.md`, `docs/dev/platform-maturity-roadmap.md`, `docs/dev/production-closure-ledger.md` (when present on branch), MAT-* evidence on `main`.

---

## Phase structure

| Phase | Goal | M1 run |
|-------|------|--------|
| **MAT-M1** | Low-risk enterprise hardening (no multi-region infra) | **EXECUTE** |
| **MAT-M2** | Scale / tenant operations | Design only |
| **MAT-M3** | Enterprise infrastructure placement | Design only |

---

## MAT-M1 tasks

### M1-01 — MAT-002 validator census

| Field | Value |
|-------|-------|
| **Objective** | Exact census of capability validator stubs; classify ACTIVE / TEST / FUTURE / LEGITIMATE_NOOP / INVALID_STUB |
| **Invariant** | No false positives — legitimate no-ops documented |
| **Evidence** | `docs/dev/mat-002-capability-validator-census.md` |
| **Files** | `apps/api/src/tours/workspace-capability-validation-bindings.generated.ts` |
| **Dependencies** | CW8 validation pipeline certified |
| **Implementation** | Static audit of 7 registry rows |
| **Focused validation** | Census table peer review |
| **Aggregate validation** | `cw8-07-pipeline-order-cert.spec.ts` |
| **Rollback** | N/A (doc only) |
| **Risk** | LOW |
| **Status** | [x] complete |

### M1-02 — MAT-002 real capability validators

| Field | Value |
|-------|-------|
| **Objective** | Replace INVALID_STUB validators with smallest semantic validators for active production capabilities |
| **Invariant** | CW pipeline order; capability isolation; no Denali rules in generic layer |
| **Evidence** | `apps/api/src/tours/capability-validators/*`, census doc |
| **Files** | `validation-pipeline.mjs`, generated bindings, 5 validator modules |
| **Dependencies** | M1-01 |
| **Implementation** | Equipment, transport, pricing, difficulty/fitness, itinerary structural validators; booking/finance documented no-ops |
| **Focused validation** | `capability-validators.spec.ts` |
| **Aggregate validation** | `run-workspace-validation-pipeline.spec.ts`, `test:parity`, Denali/Urban regression |
| **Rollback** | Revert validator modules; restore noop codegen |
| **Risk** | MEDIUM — false positive publish blocks |
| **Status** | [x] complete |

### M1-03 — MAT-014 deprecation policy

| Field | Value |
|-------|-------|
| **Objective** | Formal deprecation lifecycle for APIs, capabilities, manifests, profiles |
| **Invariant** | Evidence-based removal; no fake calendar enforcement |
| **Evidence** | `docs/standards/deprecation-policy.md` |
| **Files** | `scripts/guards/guard-deprecation-policy.mjs` |
| **Dependencies** | None |
| **Implementation** | Policy doc + lightweight guard |
| **Focused validation** | `pnpm run guard:deprecation-policy` |
| **Aggregate validation** | `phase-6:guard` (doc presence) |
| **Rollback** | Remove guard script |
| **Risk** | LOW |
| **Status** | [x] complete |

### M1-04 — MAT-015 SLO / error budget / paging baseline

| Field | Value |
|-------|-------|
| **Objective** | Internal SLO baseline; separate SLA; document measurement gaps |
| **Invariant** | No external SLA without production evidence |
| **Evidence** | `docs/operations/service-level-objectives.md` |
| **Files** | Cross-ref `docs/phase-7/appendices/OBSERVABILITY-RUNBOOK.md` |
| **Dependencies** | Existing `http.request` logging |
| **Implementation** | Five service areas with SLI/SLO/budget/alert matrix |
| **Focused validation** | Doc review |
| **Aggregate validation** | `audit-log-fields.mjs` (existing) |
| **Rollback** | N/A |
| **Risk** | LOW |
| **Status** | [x] complete |

### M1-05 — MAT-001 versioning design

| Field | Value |
|-------|-------|
| **Objective** | Design capability/profile versioning — no runtime migration |
| **Invariant** | Smallest model; workspace+profile+capabilities+policy unchanged |
| **Evidence** | `docs/dev/mat-001-capability-profile-versioning-design.md` |
| **Files** | Design doc only |
| **Dependencies** | M1-02, M1-03 |
| **Implementation** | READY_FOR_IMPLEMENTATION verdict |
| **Focused validation** | Design review checklist §3 |
| **Aggregate validation** | N/A |
| **Rollback** | N/A |
| **Risk** | LOW |
| **Status** | [x] complete |

### M1-06 — M1 aggregate gates

| Field | Value |
|-------|-------|
| **Objective** | Green M1 certification bundle |
| **Invariant** | No CW baseline modification |
| **Evidence** | Gate log in PR / agent report |
| **Dependencies** | M1-01..M1-05 |
| **Implementation** | Run gate script bundle |
| **Focused validation** | Per-gate |
| **Aggregate validation** | See §M1 aggregate gates below |
| **Rollback** | Revert branch |
| **Risk** | LOW |
| **Status** | [v] implemented, closure pending |

---

## MAT-M1 aggregate gates

```bash
pnpm --filter @apps/api run test -- src/tours/capability-validators/capability-validators.spec.ts
pnpm --filter @apps/api run test -- src/tours/run-workspace-validation-pipeline.spec.ts
pnpm --filter @apps/api run test -- src/tours/cw8-07-pipeline-order-cert.spec.ts
pnpm run test:parity
pnpm --filter @app-tour/workspace-denali test
pnpm --filter @app-tour/workspace-urban test
pnpm run generate:workspace-registry -- --check
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run guard:tour-core-boundary
pnpm run guard:no-workspace-type-branches
pnpm run guard:api-workspace-isolation
pnpm run guard:deprecation-policy
pnpm run baseline:cw-compare
git diff --check
```

---

## MAT-M2 tasks (design only — do not execute)

### M2-01 — MAT-001 implementation

| Field | Value |
|-------|-------|
| **Objective** | `profileVersion`, `capabilityRevision`, tenant pin metadata + codegen resolver |
| **Invariant** | Unpinned behavior unchanged; dual revision dispatch only when needed |
| **Evidence** | Migration spec + tenant pin API |
| **Dependencies** | M1-05, MAT-010 design |
| **Runtime primitives** | Tenant metadata store, registry resolver, upgrade preflight |
| **Pause points** | After schema; after codegen; before tenant migration job |
| **Customer evidence needed** | At least one tenant pin/upgrade dry-run |
| **Risk** | HIGH |
| **Status** | [ ] not started |

### M2-02 — MAT-011 quota / noisy-neighbor

| Field | Value |
|-------|-------|
| **Objective** | Per-tenant rate limits, queue fairness, concurrency caps |
| **Invariant** | Platform rate-limit remains; tenant metering additive |
| **Dependencies** | MAT-012 metrics sink |
| **Runtime primitives** | Redis/token bucket per `tenantId`, queue priority |
| **Pause points** | Shadow mode → enforce mode |
| **Customer evidence needed** | Load test showing neighbor isolation |
| **Risk** | HIGH |
| **Status** | [ ] not started |

### M2-03 — MAT-012 per-tenant observability / SLO

| Field | Value |
|-------|-------|
| **Objective** | Tenant dashboards, SLO burn alerts, validation stage tags |
| **Invariant** | No PII in tenant metrics labels |
| **Dependencies** | M1-04 SLO doc, staging log sink |
| **Runtime primitives** | Log/metric labels: `tenantId`, `workspaceType`, `validationStage` |
| **Pause points** | After metric export; before paging wiring |
| **Customer evidence needed** | Staging burn drill |
| **Risk** | MEDIUM |
| **Status** | [ ] not started |

### M2 dependency graph

```text
M1-05 (MAT-001 design) → M2-01 (implementation)
M1-04 (SLO baseline) → M2-03 (tenant observability)
M2-03 → M2-02 (quota — needs tenant metrics)
MAT-010 design (M3) → M2-01 pin + stamp join
```

---

## MAT-M3 tasks (design only — do not execute)

### M3-01 — MAT-010 deployment stamp / per-tenant bundle

| Field | Value |
|-------|-------|
| **Objective** | Fixed per-tenant manifest/registry fingerprint at deploy time |
| **Invariant** | `workspace + profile + capabilities + workspacePolicy` model unchanged |
| **Placement modes** | `SHARED`, `DEDICATED_DB`, `DEDICATED_STAMP`, `REGIONAL_STAMP` |
| **Dependencies** | REM-007 manifest fingerprint, M2-01 pins |
| **Runtime primitives** | Stamp table, reload guard, rollback to prior stamp |
| **Pause points** | Read-only stamp → write pin |
| **Customer evidence needed** | Prod deploy rehearsal |
| **Risk** | HIGH |
| **Status** | [ ] not started |

### M3-02 — MAT-013 data residency / regionalization

| Field | Value |
|-------|-------|
| **Objective** | Regional placement without Tour Core redesign |
| **Invariant** | Business architecture unchanged; infra placement only |
| **Dependencies** | M3-01 stamps, Postgres multi-region strategy |
| **Runtime primitives** | `REGIONAL_STAMP` routing, tenant→region map |
| **Pause points** | Metadata region tag → data plane move |
| **Customer evidence needed** | Legal residency requirement + RPO/RTO |
| **Risk** | VERY HIGH |
| **Status** | [ ] not started |

### M3 dependency graph

```text
M2-01 (version pins) → M3-01 (deployment stamps)
M3-01 → M3-02 (regional stamps)
```

---

## Progress summary

| Phase | Total tasks | Complete | Pending | Blocked |
|-------|-------------|----------|---------|---------|
| MAT-M1 | 6 | 5 | 1 (gates) | 0 |
| MAT-M2 | 3 | 0 | 3 | 0 |
| MAT-M3 | 2 | 0 | 2 | 0 |
| **MAT total** | **11** | **5** | **6** | **0** |

---

## Deferred MAT scope (unchanged)

| ID | Phase | Notes |
|----|-------|-------|
| MAT-003..009 | Pre-M2 | See `platform-maturity-roadmap.md` |
| MAT-016..025 | Long-term | LOOP #4 additions |

**Explicitly not started:** Wallet, Ticketing, Weather, Driver Settlement, payment deadline.

*Architect, documentation status: Updated. Link to docs: `docs/dev/enterprise-maturity-plan.md`.*
