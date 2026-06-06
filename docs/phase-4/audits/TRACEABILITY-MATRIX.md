# Phase 4 — Traceability matrix

> **Chain model:** Requirement → Action → Artifact → Validation → Completion  
> **FAIL token:** any row marked `chain: FAIL` must be repaired before claiming phase closure.

```yaml
traceability_meta:
  phase_id: "4"
  date: "2026-06-04"
  last_verified: "2026-06-04"
  consistency_audit: audits/CONSISTENCY-REPORT.md
  chain_status: PASS
  fail_chains_remaining: 0
  scope: documentation_graph_only
  repo_truth: IMPLEMENTATION-TRUTH.md + reports/phase-4-gate-*.json
  gap_register: PHASE-4-GAP-REGISTER.md
  requirement_source: phase-4-enforcement.md verification_table
  action_source: subphases/*.md + audits/execution-action-index.md
  validation_source: audits/verification-matrix.md + phase-4-guard.md
  completion_source: phase-4-enforcement.md phase_4_dod + subphase exit_criteria_* + state-machine DONE
```

---

## P4-E-* enforcement chain (primary)

| Requirement | Action(s) | Artifact | Validation | Completion |
|-------------|-----------|----------|------------|------------|
| **P4-E-RF-40** Red-flag prerequisite | 4.0 tracks R0–R3; report authoring; `p4_red_flag_prerequisite` | `reports/phase-3.2-red-flag-status-*.md` | Guard file exists check; R0–R3 exit in 4.0 | E40-1, E40-6; **DOD-1**; subphase 4.0 PASS → 4.1 allowed |
| **P4-E-AUTH-01** Dev bearer dead in prod | 4.0-R0 actions; `tenant-kernel.spec.ts` | `apps/api/src/tenant-kernel/*` | `tenant-security.spec.ts` + AUTH-1 matrix | E40-2; guard indirect via 4.0 |
| **P4-E-SCALE-01** O(1) tenant write | 4.0-R2 actions; 4.2 storage path | `in-memory-tour.repository.spec.ts`; Prisma repos | repository spec + doc Big-O | E40-4; 4.2 implied; **DOD** via scale honesty |
| **P4-E-HOST-01** Host parse reserved | 4.1-S1..S11; `4.1-S5`, `4.1-S6` | `packages/tenant-kernel/`; `phase-4.contract.spec.ts` | `p4_tenant_kernel_test`; `p4_contract_spec`; TK-1/TK-2 | exit_criteria_4_1; **DOD-2** |
| **P4-E-RLS-02** set_config transactional | 4.1-S6 contract; **4.2-S9** | `phase-4.contract.spec.ts`; session leak test | `p4_contract_spec` | 4.1 + 4.2 exit; contract row |
| **P4-E-RLS-01** RLS blocks cross-tenant | **4.2-S7** | `rls-isolation.integration.spec.ts` | RLS-1 matrix; integration test | exit_criteria_4_2; **DOD-5** |
| **P4-E-DATA-01** Postgres SoT | **4.2-S5**, **4.2-S8** | `apps/api/main.ts` Prisma default; tours table | restart + find tour | exit_criteria_4_2; **DOD-5**; phase_5_entry item 4 |
| **P4-E-TENANT-01** Tenant context on API | **4.3-S3** | tenant-scoped routes; seed tenants | `tenant-security.spec.ts` | exit_criteria_4_3; **DOD-6** partial |
| **P4-E-EVT-01** Event tenantId | **4.5-S1..S4** | `packages/platform-events/`; CanonicalTourService hook | `p4_platform_events_test`; EVT-1 | exit_criteria_4_5; **DOD-8** |
| **P4-E-REG-03** Phase 3 regression | **4.6-S1** (step 3 of gate) | nested `phase-3:gate` in package.json | phase-3:gate exit 0 inside gate | **4.6** exit; closure |
| **P4-E-GATE** Phase 4 closure | **4.6-S1** | `reports/phase-4-gate-*.json` | `pnpm run phase-4:gate` exit 0 | exit_criteria_4_6; **DOD-9**; `current_subphase: DONE` |

---

## Test-matrix requirements (no P4-E-* id)

| Requirement | Action(s) | Artifact | Validation | Completion | Chain |
|-------------|-----------|----------|------------|------------|-------|
| **TH-1** Tenant theme isolation | **4.4-S1..S4**; `4.4-S4` | tenant-config API; web layout | TH-1 test matrix; e2e accent | exit_criteria_4_4; **DOD-7** | **PASS** (via DOD-7) |
| **OBS-1** Structured logs | observability scaffold hooks | log fields in API | code review; non-gating | optional forensic | **PASS** (non-gating) |

---

## Phase DoD chain (closure rollup)

| Requirement | Action | Artifact | Validation | Completion |
|-------------|--------|----------|------------|------------|
| **DOD-1** | 4.0 complete | red-flag report | P4-E-RF-40 | 4.0 exit |
| **DOD-2** | 4.1 complete | tenant-kernel package | build + test + contract | 4.1 exit |
| **DOD-3** | 4.5 package | platform-events | build + test | 4.5 exit |
| **DOD-4** | 4.2-S1 compose | `infra/docker-compose.yml` | `p4_infra_compose` | 4.2 exit |
| **DOD-5** | 4.2-S7,S8 | Prisma + RLS tests | P4-E-RLS-01, P4-E-DATA-01 | 4.2 exit |
| **DOD-6** | 4.3-S1..S3 | two tenants | MAP 4.3 test | 4.3 exit |
| **DOD-7** | 4.4-S1..S4 | TenantTheme from API | TH-1 | 4.4 exit |
| **DOD-8** | 4.5-S3,S4 | TourCreated | P4-E-EVT-01 | 4.5 exit |
| **DOD-9** | **4.6-S1** | gate report JSON | P4-E-GATE | 4.6 exit |
| **DOD-10** | **4.6-S2** | forensic mdoc | Purity ≥ 8 | 4.6 exit |
| **DOD-11** | **4.6-S3** | verification-matrix | each P4-E row | 4.6 exit |
| **DOD-12** | **4.6-S4** | phase-registry | guard:doc-sync | 4.6 exit → **DONE** |

---

## Subphase → requirement rollup

| Subphase | Requirements | Primary actions | Completion gate |
|----------|--------------|-----------------|-----------------|
| 4.0 | RF-40, AUTH-01, SCALE-01 | R0–R3 tracks | exit_criteria_4_0 |
| 4.1 | HOST-01, RLS-02 | 4.1-S1..S11 | exit_criteria_4_1 |
| 4.2 | RLS-01, DATA-01, SCALE-01 | 4.2-S2..S9 | exit_criteria_4_2 |
| 4.3 | TENANT-01 | 4.3-S1..S3 | exit_criteria_4_3 |
| 4.4 | TH-1 → DOD-7 | 4.4-S1..S4 | exit_criteria_4_4 |
| 4.5 | EVT-01 | 4.5-S1..S4 | exit_criteria_4_5 |
| 4.6 | GATE, REG-03 | 4.6-S1..S4 | exit_criteria_4_6 + phase_4_dod |

---

## Phase 5 entry chain (handoff)

| Requirement | Action | Artifact | Validation | Completion |
|-------------|--------|----------|------------|------------|
| phase_5_entry item 1 | human doc sections 8–16 | `phase-4-tenant-kernel.md` | architect review | Phase 5.0 |
| phase_5_entry item 2 | **4.6-S1** | gate green | P4-E-GATE | Phase 5.0 |
| phase_5_entry item 3 | **4.6-S2** | forensic mdoc | Purity ≥ 8 | Phase 5.0 |
| phase_5_entry item 4 | **4.2-S5,S8** | Postgres runtime | P4-E-DATA-01 | Phase 5.0 |
| phase_5_entry item 5 | **4.2-S2,S7** | RLS SQL | P4-E-RLS-01 | Phase 5.0 |
| phase_5_entry item 6 | **4.5-S2** | event hook | P4-E-EVT-01 | Phase 5.0 |

---

## Module cross-reference

| Module | Role in chain |
|--------|----------------|
| [phase-4-overview.md](../phase-4-overview.md) | STEP 1 requirement registry (T2) |
| [phase-4-state-machine.md](../phase-4-state-machine.md) | transition → completion DONE |
| [phase-4-ai-exec.md](../phase-4-ai-exec.md) | agent routing |
| [subphases/](../subphases/) | actions + exit |
| [phase-4-enforcement.md](../phase-4-enforcement.md) | requirements + DoD |
| [ci.md](../ci.md) | P4-CMD-* validation commands |
| [phase-4-guard.md](../phase-4-guard.md) | p4_* validation |
| [verification-matrix.md](verification-matrix.md) | P4-E ↔ p4_* binding |
| [execution-action-index.md](execution-action-index.md) | step ID index |
| [subphase-enforcement-map.md](subphase-enforcement-map.md) | subphase ↔ P4-E |
| [appendices/test-matrix.md](../appendices/test-matrix.md) | TH-1, TK-*, RLS-1 |
| [appendices/dependency-graph.md](../appendices/dependency-graph.md) | package edges (T2) |

---

## Chain status summary

| Requirement class | Rows | Status |
|-------------------|------|--------|
| P4-E-* (11) | § P4-E enforcement chain | **PASS** |
| TH-1, OBS-1 | § Test-matrix requirements | **PASS** |
| DOD-1..12 | § Phase DoD chain | **PASS** |
| phase_5_entry | § Phase 5 handoff | **PASS** |

## Historical repairs (archived)

| ID | Issue | Resolution |
|----|-------|------------|
| BC-01 | Wrong 4.0 path in action index | `4.0-gate-of-gates.md` |
| BC-02 | P4-E-GATE missing in enforcement | Added to `verification_table` |
| BC-03 | Overview enforcement_ids drift | Synced |
| BC-04 | DOD-11 §14.1 reference | verification-matrix |
| BC-05 | state-machine §14.1 PR rule | verification-matrix |

**Current audit:** [CONSISTENCY-REPORT.md](CONSISTENCY-REPORT.md) — **0 FAIL chains**
