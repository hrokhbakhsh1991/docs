# AI-EXECUTION DOCUMENT — Phase 2 (canonical index)

**Modular layout:** [`README.md`](README.md)

```yaml
document_meta:
  source_file: docs/phase-2-design-system.md
  canonical_markdoc: docs/phase-2-design-system.mdoc
  transformation_version: "2026-06-03"
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD_WHERE_DOC_DRIFT
  doc_revision: "2026-06-03-phase-2-ai-exec"
  forensic_audit: docs/audits/phase-2-zero-debt-forensic-audit-2026-06-02.mdoc
  integrity_audit: docs/audits/phase-2-documentation-integrity-2026-06-03.mdoc
  ai_exec_index: docs/phase-2/phase-2.ai-exec.index.md
  ai_exec_modules: docs/phase-2/
  modular_split_version: "2026-06-04"
  quality_report: docs/phase-2/QUALITY-VALIDATION.md
  quality_pass_date: "2026-06-04"
  central_stub: docs/phase-2-design-system.ai-exec.md
  phase_id: "2"
  phase_name: "Design System & Enterprise Visual Layer"
  subphases: ["2.1", "2.2", "2.2.1", "2.3", "2.4", "2.5"]
  phase_detection_blocker: null
```

---

## STEP 1 — PHASE DETECTION

```yaml
phase_id: "2"
phase_name: "Design System & Enterprise Visual Layer"
prerequisite_phase: "1"
prerequisite_gate: pnpm run phase-1:gate
closure_command: pnpm run phase-2:gate
phase_detection_blocker: null
detected_from: phase-2-overview.md STEP 1
```

---

## AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  1_phase_detection:
    action: READ phase-2-overview.md STEP 1 yaml
    verify: phase_id == "2"
  2_prerequisite_verification:
    action: RUN pnpm run phase-1:gate
    gate: exit 0
  3_subphase_selection:
    action: RUN exit_criteria 2.1 → 2.5; enforce 2.2.1 T-1–T-7 with 2.2
  4_DAG_enforcement:
    action: READ phase-2-state-machine.md
    forbid: barrel ui-primitives · platform-core design-tokens · theme-react/internal
  5_gate_execution:
    action: RUN pnpm run phase-2:gate
    bind: p2_* from phase-2-guards.md
  6_audit_generation:
    action: VERIFY reports/phase-2-gate-*.json all required p2_* ok
  7_next_phase_handoff:
    action: READ phase-2-enforcement.md phase_3_entry_checklist when DONE
```

---

## Module map

| Section | File |
|---------|------|
| STEP 1 — Phase detection | [`phase-2-overview.md`](phase-2-overview.md) |
| STATE MODEL · DAG | [`phase-2-state-machine.md`](phase-2-state-machine.md) |
| Forensic truth §13 | [`audits/forensic-template.md`](audits/forensic-template.md) |
| §1–§5 | [`phase-2-overview.md`](phase-2-overview.md) |
| Subphase 2.1 | [`subphases/2.1-design-tokens.md`](subphases/2.1-design-tokens.md) |
| Subphase 2.2 | [`subphases/2.2-workspace-theme-contract.md`](subphases/2.2-workspace-theme-contract.md) |
| Subphase 2.2.1 | [`subphases/2.2.1-theme-ingress-security.md`](subphases/2.2.1-theme-ingress-security.md) |
| Subphase 2.3 | [`subphases/2.3-ui-primitives.md`](subphases/2.3-ui-primitives.md) |
| Subphase 2.4 | [`subphases/2.4-theme-react.md`](subphases/2.4-theme-react.md) |
| Subphase 2.5 | [`subphases/2.5-visual-qa-gate.md`](subphases/2.5-visual-qa-gate.md) |
| Test matrix | [`appendices/test-matrix.md`](appendices/test-matrix.md) |
| Guards p2_* | [`phase-2-guards.md`](phase-2-guards.md) |
| CI / phase-2:gate | [`phase-2-ci.md`](phase-2-ci.md) |
| Forbidden · DoD · Phase 3 entry | [`phase-2-enforcement.md`](phase-2-enforcement.md) |
| Verification matrix | [`audits/verification-matrix.md`](audits/verification-matrix.md) |
| Quality validation | [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) |
| Appendices A–E | [`appendices/`](appendices/) |

---

## AGENT EXECUTION ALGORITHM

```yaml
algorithm:
  1: "VERIFY phase_1 DONE — pnpm run phase-1:gate exit 0"
  2: "SET current_subphase from repo by running exit_criteria checks 2.1→2.5"
  3: "IF modifying packages/design-tokens packages/ui-primitives packages/theme-react packages/workspace-sdk theme files THEN update docs/phase-2-design-system.mdoc FIRST per Zero-Debt Covenant"
  4: "EXECUTE only tasks for current_subphase; 2.2.1 T-1–T-7 MUST ship with 2.2"
  5: "FORBIDDEN barrel @app-tour/ui-primitives — subpaths only"
  6: "FORBIDDEN platform-core dependency on design-tokens"
  7: "AFTER subphase 2.5 OR any phase-2 package change RUN pnpm run phase-2:gate"
  8: "BIND guards to p2_* IDs in phase-2-guard.mjs — never stale Appendix G numbered table 1-10"
  9: "BIND thresholds workspace-sdk 50 ui-primitives 12 theme-react 4 visual 4 from gate-thresholds.mjs"
  10: "IF all phase_3_entry_checklist technical items PASS SET current_subphase DONE"
  11: "APPEND: Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL]"
```


---

## DOC_DRIFT REGISTER (SOURCE MD/Mdoc vs REPO)

```yaml
doc_drift:
  - id: DRIFT-P2-01
    source: "md/mdoc Appendix G phase-2:gate JSON omits validate-design-tokens guard:artifact-surface audit-boundary"
    repo: "package.json phase-2:gate includes all three between import-boundary and phase-2:guard"
    resolution: "Execute package.json chain in CI_PIPELINE section — not stale JSON block"
  - id: DRIFT-P2-02
    source: "md/mdoc Appendix G and §11.1 include guard:symlink in phase-2:gate"
    repo: "package.json phase-2:gate has NO guard:symlink"
    resolution: "Do NOT add symlink to phase-2:gate unless package.json changes"
  - id: DRIFT-P2-03
    source: "Appendix G guard table uses numbered checks 1-10 without p2_* ids"
    repo: "scripts/guards/phase-2-guard.mjs emits p2_design_tokens_dist through p2_platform_core_no_tokens"
    resolution: "Use GUARDS section p2_* list for agent binding"
  - id: DRIFT-P2-04
    source: "Appendix G check 3 workspace-sdk count < 133 monorepo min narrative"
    repo: "gate-thresholds.mjs WORKSPACE_SDK_TEST_MIN.phase2 = 50 enforced by p2_workspace_sdk_tests"
    resolution: "Enforce 50 for phase-2-guard — 133 is stale monorepo wording"
  - id: DRIFT-P2-05
    source: "mdoc Appendix G phase-2:guard path scripts/guards/phase-2-guard.mjs only"
    repo: "package.json phase-2:guard → scripts/phase-2-guard.mjs delegates to guards/"
    resolution: "pnpm run phase-2:guard uses package.json entrypoint"
  - id: DRIFT-P2-06
    source: "phase-2-guard table lists guard:architecture and guard:import-boundary as checks 6-7 inside guard"
    repo: "phase-2-guard.mjs does NOT invoke depcruise — only phase-2:gate steps 3-4"
    resolution: "Run full phase-2:gate for depcruise; phase-2:guard alone is insufficient"
  - id: DRIFT-P2-07
    source: "§11.1 summary phase-2:gate = build + test + architecture + import-boundary + symlink + phase-2:guard"
    repo: "eight-step chain with validate-design-tokens artifact-surface audit-boundary"
    resolution: "REPO_SCRIPTS_OVER_STALE_MD"
  - id: DRIFT-P2-08
    source: "Test matrix T-2 row label 65th key vs rule T-3 THEME_CSS_VARIABLE_LIMIT"
    repo: "both refer to css variable count limit — align tests to theme.spec.ts"
    resolution: "Execute T-3 rule id for 65th key scenario"
  - id: DRIFT-P2-09
    source: "md §9.3 shows packages/ui-primitives/src/index.ts barrel"
    repo: "barrel forbidden — p2_ui_primitives_no_barrel"
    resolution: "subpath exports only — no src/index.ts barrel in production policy"
  - id: DRIFT-P2-10
    source: "phase-2 modular docs and narrative cite platform-core test floor 132"
    repo: "gate-thresholds.mjs PLATFORM_CORE_TEST_MIN.phase1 = 148"
    resolution: "PC-1 and P3E-03 reference ≥148 — not 132"
  - id: DRIFT-P2-11
    source: "md implies Husky ci:integrity equals phase-2:gate"
    repo: "ci-integrity-check.sh runs phase-0:gate + phase-1-guard only"
    resolution: "Phase 2 closure requires explicit pnpm run phase-2:gate in PR CI"
```


---

## FAIL CONDITIONS

```yaml
fail_assessment:
  phase_identification: PASS
  subphase_detection: PASS
  guard_binding: PASS when using package.json + phase-2-guard.mjs + gate-thresholds.mjs
  actionable_steps: PASS with DOC_DRIFT register DRIFT-P2-01 through DRIFT-P2-11

hard_fail_triggers:
  - condition: "Agent runs stale Appendix G phase-2:gate JSON without validate-design-tokens artifact-surface audit-boundary"
    result: FAIL — misses SB-02 enforcement and token drift guard
  - condition: "Agent adds guard:symlink to phase-2:gate because mdoc §11.1 says so"
    result: FAIL — DRIFT-P2-02 repo omits symlink
  - condition: "Agent binds guards to numbered table 1-10 instead of p2_* ids"
    result: FAIL — DRIFT-P2-03
  - condition: "Agent enforces workspace-sdk ≥133 in phase-2-guard"
    result: FAIL — DRIFT-P2-04 repo floor is 50
  - condition: "Agent imports @app-tour/ui-primitives barrel in apps or packages"
    result: FAIL — V1 barrel ban + p2_ui_primitives_no_barrel
  - condition: "Agent exports @app-tour/theme-react/internal"
    result: FAIL — SB-01 p2_theme_react_no_internal_export
  - condition: "Agent adds design-tokens dependency to platform-core"
    result: FAIL — p2_platform_core_no_tokens + F2-05b
  - condition: "Agent marks Select/Checkbox Complete and blocks gate on their absence"
    result: FAIL — §13.1 backlog explicitly not gate blockers
  - condition: "Agent runs only phase-2:guard without phase-2:gate for merge approval"
    result: FAIL — DRIFT-P2-06 misses depcruise and duplicate token validation in outer chain
  - condition: "Agent validates theme ingress before CASL in phase 3 production path"
    result: FAIL — §15.3 order law
  - condition: "Agent uses stale phase-2-design-system.md Appendix G only"
    result: FAIL — DRIFT-P2-07
  - condition: "Agent enforces platform-core regression floor 132 in phase-2 docs or gates"
    result: FAIL — DRIFT-P2-10 repo floor is 148
  - condition: "Agent treats ci:integrity pre-commit pass as phase-2:gate closure"
    result: FAIL — DRIFT-P2-11

conditional_pass:
  - "MAP §14.1 architect sign-off open while phase-2 technical gate green"
  - "Select/Checkbox backlog open while phase-2:gate green"
  - "P2-006 rgba shadows in primitives.css accepted backlog"

verdict: "PASS for AI execution when bound to repo scripts; FAIL if any hard_fail_triggers fire"
binding: REPO_SCRIPTS_OVER_STALE_MD — execute package.json phase-2:gate not mdoc Appendix G JSON alone
```


---

**Detection status:** COMPLETE — no FAIL  
**Binding:** `REPO_SCRIPTS_OVER_STALE_MD` — execute `package.json` `phase-2:gate` not stale mdoc Appendix G JSON alone.
