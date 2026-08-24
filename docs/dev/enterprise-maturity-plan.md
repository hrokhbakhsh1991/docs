# Enterprise Maturity Plan — canonical MAT ledger

**Program:** Enterprise Maturity (post-Composable Workspace foundation)  
**Baseline:** CW foundation certified; profile + capabilities + workspacePolicy; tour-core boundaries; workspace isolation  
**Date:** 2026-08-24  
**Coordinator:** Enterprise Maturity Program

**Inputs:** `docs/dev/composable-workspace-refactor-plan.md`, `docs/dev/platform-maturity-roadmap.md`, `docs/dev/production-closure-ledger.md` (when present on branch), MAT-* evidence on `main`.

---

## Phase structure

| Phase | Goal | Status |
|-------|------|--------|
| **MAT-M1** | Low-risk enterprise hardening (no multi-region infra) | **COMPLETE** |
| **MAT-M2** | Scale / tenant operations | **COMPLETE** |
| **MAT-M3** | Enterprise infrastructure placement | **COMPLETE** |

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
| **Status** | [x] complete |

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

## MAT-M2 tasks

### M2-00 — REQ-P7-007 urban digest closure (stage 0)

| Field | Value |
|-------|-------|
| **Objective** | Close platform-core digest drift before M2 implementation |
| **Verdict** | Stale evidence (A) + legitimate artifact drift (B) — not Urban regression |
| **Evidence** | `docs/dev/mat-m2-stage0-urban-digest-closure.md` |
| **Files** | `reports/phase-7-genericity-baseline.yaml`, `reports/phase-8-genericity-baseline.yaml` |
| **Focused validation** | REQ-P7-007, platform-core CW5-10 specs |
| **Status** | [x] complete |

### M2-01 — MAT-001 implementation

| Field | Value |
|-------|-------|
| **Objective** | `profileVersion`, `capabilityRevision`, tenant pin metadata + codegen resolver |
| **Invariant** | Unpinned behavior unchanged; dual revision dispatch only when needed |
| **Evidence** | `packages/workspace-sdk/src/manifest/workspace-versioning.ts`, codegen registries |
| **Files** | `manifest.schema.ts`, `versioning.mjs`, Denali `versionPins` baseline |
| **Dependencies** | M1-05 |
| **Implementation** | Integer revisions, pins, upgrade preflight, generated catalogs |
| **Focused validation** | `workspace-versioning.spec.ts`, `generate:workspace-registry --check` |
| **Aggregate validation** | Checkpoint A + M2 gates |
| **Risk** | HIGH |
| **Status** | [x] complete |

### M2-02 — MAT-011 quota / noisy-neighbor

| Field | Value |
|-------|-------|
| **Objective** | Per-workspace rate limits, concurrency caps, theme quota overrides |
| **Invariant** | Platform rate-limit remains; workspace metering additive |
| **Evidence** | `docs/operations/workspace-resource-controls.md` |
| **Files** | `workspace-resource-policy.ts`, `tenant-rate-limiter.ts`, `tour-write-concurrency-budget.ts` |
| **Dependencies** | M2-01 (orthogonal; shipped parallel) |
| **Implementation** | Workspace-scoped consumer keys, defaults, system exempt path |
| **Focused validation** | `workspace-resource-policy.spec.ts` |
| **Aggregate validation** | M2 gates |
| **Risk** | HIGH |
| **Status** | [x] complete |

### M2-03 — MAT-012 per-tenant observability / SLO

| Field | Value |
|-------|-------|
| **Objective** | Workspace SLO telemetry, validation stage tags, burn query definitions |
| **Invariant** | No PII in tenant metrics labels |
| **Evidence** | `docs/operations/service-level-objectives.md` (measurement sources) |
| **Files** | `workspace-slo-telemetry.ts`, `workspace-slo-queries.ts`, validation + booking hooks |
| **Dependencies** | M1-04 |
| **Implementation** | `workspace_slo_event_total`, registration + validation instrumentation |
| **Focused validation** | `workspace-slo-telemetry.spec.ts`, `workspace-slo-queries.spec.ts` |
| **External blockers** | Live dashboard/alert verification **BLOCKED_EXTERNAL** |
| **Risk** | MEDIUM |
| **Status** | [x] complete |

### M2-04 — M2 aggregate gates

| Field | Value |
|-------|-------|
| **Objective** | Green M2 certification bundle |
| **Evidence** | Agent report / gate log |
| **Status** | [x] complete (closure evidence — not in 11-task total) |

### M2 dependency graph (executed)

```text
Stage 0 (REQ-P7-007) → M2-01 (MAT-001)
M2-01 green → M2-02 (MAT-011) ∥ M2-03 (MAT-012)
M2-02 + M2-03 → M2-04 aggregate gates
```

---

## MAT-M2 aggregate gates

```bash
pnpm --filter @app-tour/workspace-sdk test -- test/workspace-versioning.spec.ts
pnpm --filter @apps/api run test -- src/middleware/workspace-resource-policy.spec.ts
pnpm --filter @apps/api run test -- src/observability/workspace-slo-telemetry.spec.ts
pnpm --filter @apps/api run test -- src/observability/workspace-slo-queries.spec.ts
pnpm --filter @apps/api run test -- src/tours/run-workspace-validation-pipeline.spec.ts
pnpm run test:parity
pnpm --filter @app-tour/workspace-denali test
pnpm --filter @app-tour/workspace-urban test
pnpm run generate:workspace-registry -- --check
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run guard:tour-core-boundary
pnpm run guard:no-workspace-type-branches
pnpm run guard:api-workspace-isolation
pnpm run baseline:cw-compare
git diff --check
```

---

## MAT-M3 tasks

### M3-00 — Stage 0 infrastructure pre-flight

| Field | Value |
|-------|-------|
| **Objective** | Map shared infra dependencies; classify placement readiness |
| **Evidence** | `docs/dev/mat-m3-stage0-infrastructure-preflight.md` |
| **Verdict** | AUTHORIZED — resolver layer required; no hard global blockers |
| **Status** | [x] complete |

### M3-01 — MAT-010 deployment stamp / per-tenant bundle

| Field | Value |
|-------|-------|
| **Objective** | Placement modes + deterministic bundle fingerprint + infra resolver |
| **Invariant** | `workspace + profile + capabilities + workspacePolicy` unchanged |
| **Evidence** | `docs/operations/workspace-infrastructure-placement.md`, `infra/workspace-infrastructure-registry.defaults.json` |
| **Implementation** | `resolveWorkspaceInfrastructure`, registry loader, request context |
| **Placement modes** | `SHARED`, `DEDICATED_DB`, `DEDICATED_STAMP`, `REGIONAL_STAMP` |
| **Focused validation** | tenant-kernel + API infrastructure specs |
| **External blockers** | Real stamp deploy rehearsal **BLOCKED_EXTERNAL** |
| **Status** | [x] complete |

### M3-02 — MAT-013 data residency / regionalization

| Field | Value |
|-------|-------|
| **Objective** | Region-aware placement + residency policy enforcement |
| **Invariant** | Business/domain code region-blind |
| **Evidence** | `workspace-residency-policy.ts`, operations doc § regional |
| **Policies** | `HOME_REGION_ONLY`, `APPROVED_REGIONS`, `NO_CROSS_REGION_REPLICATION` |
| **Focused validation** | Regional resource mix + cross-region safety specs |
| **External blockers** | Cross-region migration drill **BLOCKED_EXTERNAL** |
| **Status** | [x] complete |

### M3-03 — M3 aggregate gates

| Field | Value |
|-------|-------|
| **Objective** | Green M3 certification bundle |
| **Status** | [x] complete (closure evidence) |

### M3 dependency graph (executed)

```text
M3-00 (pre-flight) → M3-01 (MAT-010)
M3-01 certified → M3-02 (MAT-013)
M3-01 + M3-02 → M3-03 aggregate gates
```

---

## MAT-M3 aggregate gates

```bash
pnpm --filter @app-tour/tenant-kernel test
pnpm --filter @apps/api run test -- src/infrastructure/workspace-infrastructure-registry.spec.ts
pnpm --filter @apps/api run test -- src/infrastructure/workspace-infrastructure-request-context.spec.ts
pnpm run test:parity
pnpm --filter @app-tour/workspace-denali test
pnpm --filter @app-tour/workspace-urban test
pnpm run generate:workspace-registry -- --check
pnpm run guard:architecture
pnpm run guard:import-boundary
pnpm run guard:tour-core-boundary
pnpm run guard:no-workspace-type-branches
pnpm run guard:api-workspace-isolation
pnpm run baseline:cw-compare
git diff --check
```

---

## Progress summary

| Phase | Total tasks | Complete | Pending | Blocked |
|-------|-------------|----------|---------|---------|
| MAT-M1 | 6 | 6 | 0 | 0 |
| MAT-M2 | 3 | 3 | 0 | 0 |
| MAT-M3 | 3 | 3 | 0 | 0 |
| **MAT total** | **11** | **11** | **0** | **0** |

**ENTERPRISE MATURITY PROGRAM = COMPLETE**

Live regional/stamp deployment proof remains **BLOCKED_EXTERNAL** where provider infrastructure is unavailable.

---

## Deferred MAT scope (unchanged)

| ID | Phase | Notes |
|----|-------|-------|
| MAT-003..009 | Pre-M2 | See `platform-maturity-roadmap.md` |
| MAT-016..025 | Long-term | LOOP #4 additions |

**Explicitly not started:** Wallet, Ticketing, Weather, Driver Settlement, payment deadline.

*Architect, documentation status: Updated. Link to docs: `docs/dev/enterprise-maturity-plan.md`.*
