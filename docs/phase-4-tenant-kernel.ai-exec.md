# AI-EXECUTION DOCUMENT — Phase 4 (central index)

> **Detailed modules:** [`phase-4/phase-4.ai-exec.index.md`](phase-4/phase-4.ai-exec.index.md) · **Hub:** [`phase-4/README.md`](phase-4/README.md)

```yaml
document_meta:
  phase_id: "4"
  phase_name: "Tenant Kernel & Multi-Tenant Enterprise Boundary"
  north_star: "Every request resolves verified tenant · Postgres+RLS SoT · tenant theme from kernel"
  canonical_markdoc: docs/phase-4-tenant-kernel.mdoc
  modular_index: docs/phase-4/phase-4.ai-exec.index.md
  quality_report: docs/phase-4/QUALITY-VALIDATION.md
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD
  phase_detection_blocker: null
  prerequisite_phase: "3"
  prerequisite_gate: pnpm run phase-3:gate
  prerequisite_subphase_before_4_1: "4.0 — R0–R3 closed per docs/backlog/phase-3.2-red-flag-backlog.md"
  closure_gate: pnpm run phase-4:gate
  document_status_claim: "Open — execution spec; PRs per subphase 4.0→4.6"
```

## Subphases (execution order)

| ID | Module | PR label / rule |
|----|--------|-----------------|
| 4.0 | [`phase-4/subphases/4.0-gate-of-gates.md`](phase-4/subphases/4.0-gate-of-gates.md) | R0–R3 — **blocks 4.1+** |
| 4.1 | [`phase-4/subphases/4.1-tenant-kernel.md`](phase-4/subphases/4.1-tenant-kernel.md) | Phase: 4.1 |
| 4.2 | [`phase-4/subphases/4.2-postgres-rls.md`](phase-4/subphases/4.2-postgres-rls.md) | Phase: 4.2 |
| 4.3 | [`phase-4/subphases/4.3-provisioning.md`](phase-4/subphases/4.3-provisioning.md) | Phase: 4.3 |
| 4.4 | [`phase-4/subphases/4.4-tenant-theme.md`](phase-4/subphases/4.4-tenant-theme.md) | Phase: 4.4 (may parallel after 4.2) |
| 4.5 | [`phase-4/subphases/4.5-platform-events.md`](phase-4/subphases/4.5-platform-events.md) | Phase: 4.5 |
| 4.6 | [`phase-4/subphases/4.6-phase-gate.md`](phase-4/subphases/4.6-phase-gate.md) | Phase: 4.6 |

## Core modules

| Module | File |
|--------|------|
| Overview · STEP 1 · §1–§5 | [`phase-4/phase-4-overview.md`](phase-4/phase-4-overview.md) |
| State machine · DAG · §0 | [`phase-4/phase-4-state-machine.md`](phase-4/phase-4-state-machine.md) |
| Guards p4_* · CI | [`phase-4/phase-4-guard.md`](phase-4/phase-4-guard.md) |
| Enforcement P4-E-* · DoD · Phase 5 | [`phase-4/phase-4-enforcement.md`](phase-4/phase-4-enforcement.md) |

## Audits

| Audit | File |
|-------|------|
| Verification matrix | [`phase-4/audits/verification-matrix.md`](phase-4/audits/verification-matrix.md) |
| Quality validation | [`phase-4/QUALITY-VALIDATION.md`](phase-4/QUALITY-VALIDATION.md) |
| Forensic (on closure) | docs/audits/phase-4-zero-debt-forensic-audit.mdoc |

## Appendices

| Appendix | File |
|----------|------|
| A — Dependency graph | [`phase-4/appendices/dependency-graph.md`](phase-4/appendices/dependency-graph.md) |
| C — PR template | [`phase-4/appendices/pr-template.md`](phase-4/appendices/pr-template.md) |
| E — Test matrix | [`phase-4/appendices/test-matrix.md`](phase-4/appendices/test-matrix.md) |
| G — MAP bridge | [`phase-4/appendices/map-bridge.md`](phase-4/appendices/map-bridge.md) |

## Backlog (4.0 gate-of-gates)

| Item | File |
|------|------|
| R0–R3 red flags | [`backlog/phase-3.2-red-flag-backlog.md`](backlog/phase-3.2-red-flag-backlog.md) |
| Audit red flags | [`audit-red-flags-phase-3.md`](audit-red-flags-phase-3.md) |
| Status report (guard) | reports/phase-3.2-red-flag-status-*.md |

## Agent boot (deterministic)

```yaml
agent_boot:
  1: "READ phase-4-overview.md STEP 1 — phase_id must be 4; phase_detection_blocker must be null"
  2: "VERIFY pnpm run phase-3:gate exit 0"
  3: "VERIFY 4.0 — reports/phase-3.2-red-flag-status-*.md exists; R0–R3 closed — P4-E-RF-40"
  4: "SET current_subphase 4.0 unless 4.0 exit criteria PASS"
  5: "FORBIDDEN merge 4.1+ while R0–R3 open"
  6: "FORBIDDEN grep-only closure — run P4-E-* tests per verification_table"
  7: "FORBIDDEN platform-core imports tenant-kernel"
  8: "RUN pnpm run phase-4:gate for closure — bind p4_* not §14.2 numbered table"
  9: "BIND thresholds tenant-kernel 6 platform-events 2 from gate-thresholds.mjs"
  10: "ON DONE READ phase-4-enforcement.md phase_5_entry_requires"
  fail_token: FAIL
```

## Gate chain (package.json)

```yaml
phase_4_gate:
  step_1: pnpm build
  step_2: pnpm test
  step_3: pnpm run phase-3:gate
  step_4: pnpm run phase-4:guard
  not_in_outer_chain: [guard:architecture, guard:import-boundary]
  note: "depcruise/import-boundary run inside nested phase-3:gate — DRIFT-P4-04"
pre_commit_note: "ci:integrity does NOT run phase-4:gate — DRIFT-P4-03"
guard_report: reports/phase-4-gate-YYYY-MM-DD.json
```
