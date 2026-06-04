# AI-EXECUTION DOCUMENT — Phase 3 (canonical index)

**Modular layout:** [`README.md`](README.md)

```yaml
document_meta:
  source_file: docs/phase-3-design-system.md
  canonical_markdoc: docs/phase-3-design-system.mdoc
  transformation_version: "2026-06-03"
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD_WHERE_DOC_DRIFT
  doc_revision: "2026-06-03-phase-3-ai-exec"
  forensic_audit: docs/audits/phase-3-zero-debt-forensic-audit.mdoc
  integrity_audit: docs/audits/phase-3-documentation-integrity-2026-06-03.mdoc
  document_status_claim: "Closed: Zero-Debt Verified (2026-06-03)"
  ai_exec_index: docs/phase-3/phase-3.ai-exec.index.md
  ai_exec_modules: docs/phase-3/
  modular_split_version: "2026-06-04"
  quality_report: docs/phase-3/QUALITY-VALIDATION.md
  quality_pass_date: "2026-06-04"
  central_stub: docs/phase-3-design-system.ai-exec.md
  phase_id: "3"
  phase_name: "Design System & App Integration"
  subphases: ["3.0", "3.1", "3.2", "3.3", "3.3.x", "3.4", "3.5"]
  phase_detection_blocker: null
  prerequisite_hubs:
    - docs/phase-2/phase-2.ai-exec.index.md
  backlog_soft:
    - Playwright create tour + CASL deny DOM (non-blocking in phase-3-guard)
    - Select/Checkbox subpaths 3.3.x (p3_ui_select_checkbox_optional required:false)
```

---

## STEP 1 — PHASE DETECTION

```yaml
phase_id: "3"
phase_name: "Design System & App Integration"
prerequisite_phase: "2"
prerequisite_gate: pnpm run phase-2:gate
closure_command: pnpm run phase-3:gate
phase_detection_blocker: null
detected_from: phase-3-overview.md STEP 1
```

---

## Module map

| Section | File |
|---------|------|
| STEP 1 — Phase detection | [`phase-3-overview.md`](phase-3-overview.md) |
| STATE MODEL · DAG | [`phase-3-state-machine.md`](phase-3-state-machine.md) |
| Forensic truth §3 | [`audits/forensic-template.md`](audits/forensic-template.md) |
| §1–§6 | [`phase-3-overview.md`](phase-3-overview.md) |
| Subphase 3.0 | [`subphases/3.0-casl-authority.md`](subphases/3.0-casl-authority.md) |
| Subphase 3.1 | [`subphases/3.1-workspace-starter.md`](subphases/3.1-workspace-starter.md) |
| Subphase 3.2 | [`subphases/3.2-apps-api.md`](subphases/3.2-apps-api.md) |
| Subphase 3.3 | [`subphases/3.3-apps-web.md`](subphases/3.3-apps-web.md) |
| Subphase 3.3.x | [`subphases/3.3.x-select-checkbox.md`](subphases/3.3.x-select-checkbox.md) |
| Subphase 3.4 | [`subphases/3.4-canonical-sot.md`](subphases/3.4-canonical-sot.md) |
| Subphase 3.5 | [`subphases/3.5-observability-gate.md`](subphases/3.5-observability-gate.md) |
| P3-E-* enforcement | [`phase-3-enforcement.md`](phase-3-enforcement.md) |
| Guards p3_* | [`phase-3-guards.md`](phase-3-guards.md) |
| CI / phase-3:gate | [`phase-3-ci.md`](phase-3-ci.md) |
| Verification matrix | [`audits/verification-matrix.md`](audits/verification-matrix.md) |
| Quality validation | [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) |
| Appendices A–G | [`appendices/`](appendices/) |

---

## AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  1_phase_detection:
    action: READ phase-3-overview.md STEP 1 yaml
    verify: phase_id == "3"
  2_prerequisite_verification:
    action: RUN pnpm run phase-2:gate
    gate: exit 0
  3_subphase_selection:
    action: RUN exit_criteria checks 3.0 → 3.5 per subphases/*.md
    rule: 3.1+ code PRs require doc-gate before merge
  4_DAG_enforcement:
    action: READ phase-3-state-machine.md transition_rules + forbidden_transition
    forbid: denali import · barrel ui-primitives · theme ingress before ability.can
  5_gate_execution:
    action: RUN pnpm run phase-3:gate
    bind: p3_* from phase-3-guards.md — not stale §13.5 numbered table
  6_audit_generation:
    action: VERIFY reports/phase-3-gate-*.json all required p3_* ok
    forensic: docs/audits/phase-3-zero-debt-forensic-audit.mdoc
  7_next_phase_handoff:
    action: READ phase-3-enforcement.md PHASE 4 ENTRY when phase_3_dod ALL hard items PASS
    prerequisite_for_4: phase-3:gate + phase-4.0 gate-of-gates per phase-4 index
```

---

## AGENT EXECUTION ALGORITHM

```yaml
algorithm:
  1: "VERIFY phase_2 DONE — pnpm run phase-2:gate exit 0"
  2: "SET current_subphase from repo by running exit_criteria checks 3.0→3.5"
  3: "IF modifying packages/workspace-sdk packages/workspaces/starter apps/* theme paths THEN update docs/phase-3-design-system.mdoc FIRST per Zero-Debt Covenant"
  4: "EXECUTE only tasks for current_subphase; 3.1+ code PRs require pnpm run doc-gate"
  5: "FORBIDDEN barrel @app-tour/ui-primitives — subpaths only"
  6: "FORBIDDEN static workspaces/denali — p3_no_denali"
  7: "MANDATORY handoff: ability.can BEFORE validateWorkspaceThemeIngress BEFORE DOM"
  8: "defineAbilityFor import path: packages/workspace-sdk/src/auth/casl/index.ts"
  9: "Ability tests live under packages/workspace-sdk/test/auth/ — not src/auth/ability.spec.ts"
  10: "AFTER subphase 3.5 OR any phase-3 app/package change RUN pnpm run phase-3:gate"
  11: "BIND guards to p3_* IDs in phase-3-guard.mjs — never stale §13.5 numbered table"
  12: "BIND thresholds from gate-thresholds.mjs: sdk 100 starter 15 api 20 web 10"
  13: "IF all phase_3_complete_when_ALL PASS SET current_subphase DONE"
  14: "Do NOT assume ci:integrity runs phase-3:gate — use workflow or explicit command"
  15: "APPEND: Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL]"
```

---

## DOC_DRIFT REGISTER

```yaml
doc_drift:
  - id: DRIFT-P3-01
    source: "md §13.4 phase-3:gate JSON omits pnpm run doc-gate"
    repo: "package.json phase-3:gate includes doc-gate before phase-3:guard"
    resolution: "Execute package.json 9-step chain — DRIFT-P3-01"
  - id: DRIFT-P3-02
    source: "md §13.5 guard table numbered 1-9 without p3_* enforcement binding"
    repo: "scripts/guards/phase-3-guard.mjs emits p3_doc_gate … p3_no_denali"
    resolution: "Use GUARDS section p3_* list — not §13.5 narrative"
  - id: DRIFT-P3-03
    source: "md §8.3 ability tests ≥8 / 23 in packages/workspace-sdk/src/auth/ability.spec.ts"
    repo: "tests in packages/workspace-sdk/test/auth/*.spec.ts; gate floor 100 total sdk tests"
    resolution: "Enforce p3_workspace_sdk_tests ≥100 — ability count is subset not gate id"
  - id: DRIFT-P3-04
    source: "md §15.0 table claims 15 ability tests for 3.0"
    repo: "test/auth/ multi-file suite; inconsistent with §8.3 count 23"
    resolution: "Do not block on doc narrative count — enforce gate-thresholds + p3_workspace_sdk_tests"
  - id: DRIFT-P3-05
    source: "md Appendix G ادغام نهایی add phase-3:gate to ci:integrity"
    repo: "scripts/ci-integrity-check.sh phase-0 + phase-1 only"
    resolution: "Phase 3 CI = .github/workflows/phase-3-gate.yml — not pre-commit ci:integrity"
  - id: DRIFT-P3-06
    source: "md §13.4 does not list phase-2:gate position relative to doc-gate"
    repo: "phase-2:gate step 7 then doc-gate step 8 then phase-3:guard step 9"
    resolution: "Frozen baseline before doc-gate then p3 guard"
  - id: DRIFT-P3-07
    source: "md §8.2 task 1 ability.ts defineAbilityFor"
    repo: "defineAbilityFor exported from packages/workspace-sdk/src/auth/casl/index.ts; ability.ts re-exports TenantAuthz"
    resolution: "Import @app-tour/workspace-sdk/auth/casl for defineAbilityFor"
  - id: DRIFT-P3-08
    source: "md §13.5 check 7 Select/Checkbox blocking if 3.3.x merged"
    repo: "p3_ui_select_checkbox_optional required:false always ok:true"
    resolution: "Select/Checkbox optional until subpaths ship — not merge blocker"
  - id: DRIFT-P3-09
    source: "md §11.1 Playwright listed as exit criteria unchecked"
    repo: "phase-3-guard has no Playwright check — soft backlog"
    resolution: "W-3 W-4 non-blocking per document_status backlog"
  - id: DRIFT-P3-10
    source: "md treats doc-gate as phase-3:gate step 8 only"
    repo: "p3_doc_gate also runs inside phase-3-guard.mjs as first check"
    resolution: "Intentional duplicate — both must PASS; do not skip p3_doc_gate when guard runs"
```

---

## FAIL CONDITIONS

```yaml
fail_assessment:
  phase_identification: PASS
  subphase_detection: PASS
  guard_binding: PASS when using package.json + phase-3-guard.mjs + gate-thresholds.mjs
  actionable_steps: PASS with DOC_DRIFT register DRIFT-P3-01 through DRIFT-P3-10

hard_fail_triggers:
  - condition: "Agent runs stale §13.4 phase-3:gate JSON without doc-gate"
    result: FAIL — misses P3-E-DOC-GATE and MAP §19 scaffold
  - condition: "Agent binds guards to §13.5 numbered table instead of p3_* ids"
    result: FAIL — DRIFT-P3-02
  - condition: "Agent enforces ability tests at src/auth/ability.spec.ts path from stale md"
    result: FAIL — DRIFT-P3-03 repo uses test/auth/
  - condition: "Agent blocks phase-3:gate on missing Select/Checkbox subpaths"
    result: FAIL — DRIFT-P3-08 p3_ui_select_checkbox_optional required false
  - condition: "Agent expects ci:integrity pre-commit to run phase-3:gate"
    result: FAIL — DRIFT-P3-05
  - condition: "Agent imports @app-tour/ui-primitives barrel in apps"
    result: FAIL — P3-E-BARREL + F3-01
  - condition: "Agent calls validateWorkspaceThemeIngress before ability.can"
    result: FAIL — P3-SEC-01 + F3-04
  - condition: "Agent static imports workspaces/denali"
    result: FAIL — p3_no_denali + F3-03
  - condition: "Agent dual-writes canonical + legacy"
    result: FAIL — P3-E-CANONICAL-34 + F3-06
  - condition: "Agent runs only phase-3:guard without full phase-3:gate for merge approval"
    result: FAIL — misses build test phase-2:gate doc-gate outer chain
  - condition: "Agent marks Fully satisfied Security Seal without forensic"
    result: FAIL — F3-07 honest reporting covenant
  - condition: "Agent uses defineAbilityFor from wrong module ignoring casl/index.ts"
    result: FAIL — DRIFT-P3-07

conditional_pass:
  - "Playwright W-3 W-4 backlog while phase-3:gate green"
  - "Select/Checkbox 3.3.x optional while invariants P3-UI-01/02 open"
  - "P3-PKG-02 ESM evaluation deferred"
  - "Phase 4 tenant subdomain + RLS plan items P4E-04 P4E-05 open while Phase 3 Closed"

verdict: "PASS for AI execution when bound to repo scripts; FAIL if any hard_fail_triggers fire"
binding: REPO_SCRIPTS_OVER_STALE_MD — execute package.json phase-3:gate not §13.4 JSON alone
```
