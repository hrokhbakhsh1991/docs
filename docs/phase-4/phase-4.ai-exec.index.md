# AI-EXECUTION DOCUMENT — Phase 4 (canonical index)

**Modular layout:** [`README.md`](README.md) · **Do not load the legacy monolith** unless a tool lacks multi-file support.

```yaml
document_meta:
  source_file: docs/phase-4-tenant-kernel.md
  canonical_markdoc: docs/phase-4-tenant-kernel.mdoc
  ai_exec_index: docs/phase-4/phase-4.ai-exec.index.md
  ai_exec_modules: docs/phase-4/
  transformation_version: "2026-06-04"
  modular_split_version: "2026-06-04"
  modernization_version: "2026-06-04"
  modernization_report: docs/phase-4/MODERNIZATION-REPORT.md
  readability_report: docs/phase-4/AI-READABILITY-REPORT.md
  ai_exec_hub: docs/phase-4/phase-4-ai-exec.md
  agent_load_tiers: docs/phase-4/appendices/agent-load-tiers.md
  knowledge_index: docs/phase-4/appendices/knowledge-index.md
  future_proofing_report: docs/phase-4/FUTURE-PROOFING-REPORT.md
  future_risk_signals: docs/phase-4/appendices/future-risk-signals.md
  ci_module: docs/phase-4/ci.md
  quality_report: docs/phase-4/QUALITY-VALIDATION.md
  quality_pass_date: "2026-06-04"
  central_stub: docs/phase-4-tenant-kernel.ai-exec.md
  phase_id: "4"
  phase_name: "Tenant Kernel & Multi-Tenant Enterprise Boundary"
  subphases: ["4.0", "4.1", "4.2", "4.3", "4.4", "4.5", "4.6"]
  phase_detection_blocker: null
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD_WHERE_DOC_DRIFT
  document_status_claim: "Open — execution spec; code in PRs per subphase 4.0→4.6"
  red_flag_backlog: docs/backlog/phase-3.2-red-flag-backlog.md
  audit_red_flags: audit-red-flags-phase-3.md
  map_refs:
    - docs/MIGRATION-MAP.md §11 (phase 4)
    - docs/MIGRATION-MAP.md §7 (tenant isolation)
    - docs/MIGRATION-MAP.md §6 (events scaffold)
    - docs/MIGRATION-MAP.md §12 (Zero-Debt Covenant)
    - docs/MIGRATION-MAP.md §14 (Constitution)
    - docs/MIGRATION-MAP.md §16 (Forensic drift)
  prerequisite_hubs_modular:
    - docs/phase-0/phase-0.ai-exec.index.md
    - docs/phase-1/phase-1.ai-exec.index.md
    - docs/phase-2/phase-2.ai-exec.index.md
    - docs/phase-3/phase-3.ai-exec.index.md
  prerequisite_gates:
    - "pnpm run phase-3:gate — exit 0 (embeds phase-2:gate + doc-gate)"
    - "pnpm run phase-2:gate — exit 0 — Closed: Zero-Debt Verified"
  focus: "WHAT to build + enforceable rules — NOT pre-done commit inventory"
```

---

## STEP 1 — PHASE DETECTION

```yaml
phase_id: "4"
phase_name: "Tenant Kernel & Multi-Tenant Enterprise Boundary"
prerequisite_phase: "3"
prerequisite_gate: pnpm run phase-3:gate
prerequisite_before_4_1: "subphase 4.0 R0–R3 + reports/phase-3.2-red-flag-status-*.md"
closure_command: pnpm run phase-4:gate
phase_detection_blocker: null
detected_from: phase-4-overview.md STEP 1
```

---

## Module map (load by reference — not duplicated here)

| Section (legacy §) | Module file |
|--------------------|-------------|
| STEP 1 — Phase detection | [`phase-4-overview.md`](phase-4-overview.md#step-1--phase-detection-complete) |
| STATE MODEL · SUBPHASE DAG · §0 Alignment | [`phase-4-state-machine.md`](phase-4-state-machine.md) |
| §1–§5 Platform · enterprise · legacy · outputs · request flow | [`phase-4-overview.md`](phase-4-overview.md) |
| §7 Subphase 4.0 | [`subphases/4.0-gate-of-gates.md`](subphases/4.0-gate-of-gates.md) |
| §8 Subphase 4.1 | [`subphases/4.1-tenant-kernel.md`](subphases/4.1-tenant-kernel.md) |
| §9 Subphase 4.2 | [`subphases/4.2-postgres-rls.md`](subphases/4.2-postgres-rls.md) |
| §10 Subphase 4.3 | [`subphases/4.3-provisioning.md`](subphases/4.3-provisioning.md) |
| §11 Subphase 4.4 | [`subphases/4.4-tenant-theme.md`](subphases/4.4-tenant-theme.md) |
| §12 Subphase 4.5 | [`subphases/4.5-platform-events.md`](subphases/4.5-platform-events.md) |
| §13 Subphase 4.6 | [`subphases/4.6-phase-gate.md`](subphases/4.6-phase-gate.md) |
| §14 Verification · §15 Forbidden · §16 DoD · §17 Phase 5 | [`phase-4-enforcement.md`](phase-4-enforcement.md) |
| Guards p4_* | [`phase-4-guard.md`](phase-4-guard.md) |
| CI pipeline | [`ci.md`](ci.md) |
| Subphase ↔ enforcement | [`audits/subphase-enforcement-map.md`](audits/subphase-enforcement-map.md) |
| Observability scaffold | [`appendices/observability.md`](appendices/observability.md) |
| AI hub | [`phase-4-ai-exec.md`](phase-4-ai-exec.md) |
| Agent load tiers | [`appendices/agent-load-tiers.md`](appendices/agent-load-tiers.md) |
| Knowledge index | [`appendices/knowledge-index.md`](appendices/knowledge-index.md) |
| Execution action index | [`audits/execution-action-index.md`](audits/execution-action-index.md) |
| AI readability report | [`AI-READABILITY-REPORT.md`](AI-READABILITY-REPORT.md) |
| Traceability matrix | [`audits/TRACEABILITY-MATRIX.md`](audits/TRACEABILITY-MATRIX.md) |
| Consistency report | [`audits/CONSISTENCY-REPORT.md`](audits/CONSISTENCY-REPORT.md) |
| Verification matrix | [`audits/verification-matrix.md`](audits/verification-matrix.md) |
| Quality validation | [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) |
| Appendix — verification commands | [`appendices/verification-commands.md`](appendices/verification-commands.md) |
| Appendix — legacy bridge | [`appendices/legacy-structure-bridge.md`](appendices/legacy-structure-bridge.md) |
| Appendix — completion proof | [`appendices/subphase-completion-schema.md`](appendices/subphase-completion-schema.md) |
| Appendix A · E · G · C | [`appendices/`](appendices/) |

---

## AGENT START (link only)

> **SOLE EXECUTION ENTRY:** [`phase-4-ai-exec.md`](phase-4-ai-exec.md) — `AGENT_START_SEQUENCE` lives there only.  
> **Load tiers:** [`appendices/agent-load-tiers.md`](appendices/agent-load-tiers.md)

```yaml
sole_execution_entry: phase-4-ai-exec.md
fail_if: "Duplicate AGENT_START_SEQUENCE outside phase-4-ai-exec.md"
fail_token: FAIL
```

---

## DOC_DRIFT REGISTER

```yaml
doc_drift:
  - id: DRIFT-P4-01
    source: "narrative §14.2 numbered check 6 depcruise tenant-kernel boundary"
    repo: "phase-4-guard.mjs has no depcruise step"
    resolution: "Use guard:architecture via nested phase-3:gate — not §14.2 row 6"
  - id: DRIFT-P4-02
    source: "§14.2 table checks 1-7 without p4_* ids"
    repo: "phase-4-guard.mjs emits p4_red_flag_prerequisite through p4_infra_compose"
    resolution: "Bind agents to phase-4-guard.md p4_* list"
  - id: DRIFT-P4-03
    source: "md claims ci:integrity runs phase-4:gate on pre-commit"
    repo: "ci-integrity-check.sh phase-0:gate + phase-1-guard only"
    resolution: "Run phase-4:gate explicitly in PR CI — DRIFT-P4-03"
  - id: DRIFT-P4-04
    source: "md §14.2 implies standalone depcruise in phase-4:gate outer chain"
    repo: "package.json phase-4:gate = build + test + phase-3:gate + phase-4:guard (4 steps)"
    resolution: "Architecture/import-boundary inside phase-3:gate step 3"
  - id: DRIFT-P4-05
    source: "narrative when implemented for phase-4:gate"
    repo: "package.json phase-4:gate and phase-4-guard.mjs implemented"
    resolution: "Execute pnpm run phase-4:gate — not deferred"
  - id: DRIFT-P4-06
    source: "P4-E-* closure without test:phase-4"
    repo: "p4_contract_spec required in guard"
    resolution: "test:phase-4 + host-parse specs both required for HOST/RLS claims"
```

---

## FAIL CONDITIONS

```yaml
fail_assessment:
  phase_identification: PASS
  subphase_detection: PASS
  guard_binding: PASS when using package.json + phase-4-guard.mjs + gate-thresholds.mjs
  actionable_steps: PASS with DOC_DRIFT DRIFT-P4-01 through DRIFT-P4-06

hard_fail_triggers:
  - condition: "Agent uses §14.2 numbered table instead of p4_* ids"
    result: FAIL — DRIFT-P4-02
  - condition: "Agent expects depcruise inside phase-4:guard because §14.2 row 6"
    result: FAIL — DRIFT-P4-01
  - condition: "Agent merges 4.1+ with R0-R3 open or missing red-flag report"
    result: FAIL — P4-E-RF-40 + p4_red_flag_prerequisite
  - condition: "Agent runs only phase-4:guard for merge without phase-4:gate"
    result: FAIL — misses build test phase-3:gate
  - condition: "Agent expects ci:integrity to prove phase-4:gate"
    result: FAIL — DRIFT-P4-03
  - condition: "Agent closes phase 4 with grep-only proof"
    result: FAIL — grep_only_rule SUPPLEMENTARY_ONLY
  - condition: "Agent claims P4-E-DATA-01 done with in-memory production SoT"
    result: FAIL — DOD and P4-E-DATA-01
  - condition: "Agent static imports workspaces/denali"
    result: FAIL — p4_no_denali_in_kernel + forbidden_phase_4

conditional_pass:
  - "Playwright subdomain e2e backlog per forensic_truth"
  - "Phase 4 Open while 4.0-4.5 land in PRs — gate green only when DOD-9 satisfied"

verdict: "PASS for AI execution when bound to repo scripts; FAIL if any hard_fail_triggers fire"
binding: REPO_SCRIPTS_OVER_STALE_MD — execute package.json phase-4:gate not narrative §14.2 table alone
```

---

**Detection status:** COMPLETE — no FAIL  
**Start subphase:** `4.0` after `pnpm run phase-3:gate` exit 0  
**Binding:** `REPO_SCRIPTS_OVER_STALE_MD` — execute `package.json` `phase-4:gate` not narrative §14.2 table alone
