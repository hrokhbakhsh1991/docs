# AI-EXECUTION DOCUMENT — Phase 1 (canonical index)

**Modular layout:** [`README.md`](README.md)

```yaml
document_meta:
  source_file: docs/phase-1-platform-core.md
  canonical_markdoc: docs/phase-1-platform-core.mdoc
  transformation_version: "2026-06-03"
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD_WHERE_DOC_DRIFT
  doc_revision: "2026-06-03-df-066-086"
  ai_exec_index: docs/phase-1/phase-1.ai-exec.index.md
  ai_exec_modules: docs/phase-1/
  modular_split_version: "2026-06-04"
  quality_enhancement: "2026-06-04"
  quality_report: docs/phase-1/QUALITY-VALIDATION.md
  quality_pass_date: "2026-06-04"
  central_stub: docs/phase-1-platform-core.ai-exec.md
  phase_id: "1"
  phase_name: "Platform Core (Schema-Driven Engine)"
  subphases: ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"]
  phase_detection_blocker: null
```

---

## STEP 1 — PHASE DETECTION

```yaml
phase_id: "1"
phase_name: "Platform Core (Schema-Driven Engine)"
prerequisite_phase: "0"
prerequisite_gate: pnpm run phase-0:gate
closure_command: pnpm run phase-1:gate
phase_detection_blocker: null
detected_from: phase-1-overview.md STEP 1
```

---

## Module map

| Section | File |
|---------|------|
| STEP 1 | [`phase-1-overview.md`](phase-1-overview.md) |
| STATE · DAG | [`phase-1-state-machine.md`](phase-1-state-machine.md) |
| Forensic §9.4 | [`audits/forensic-template.md`](audits/forensic-template.md) |
| §1–§3 | [`phase-1-overview.md`](phase-1-overview.md) |
| 1.1–1.6 | [`subphases/`](subphases/) |
| API §5 | [`appendices/api-surface.md`](appendices/api-surface.md) |
| Test matrix §6 | [`appendices/test-matrix.md`](appendices/test-matrix.md) |
| Closure contracts | [`audits/closure-contracts.md`](audits/closure-contracts.md) |
| Guards g* | [`phase-1-guards.md`](phase-1-guards.md) |
| CI | [`phase-1-ci.md`](phase-1-ci.md) |
| Enforcement | [`phase-1-enforcement.md`](phase-1-enforcement.md) |
| Quality validation | [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) |
| Appendices | [`appendices/`](appendices/) |

---

## AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  1_phase_detection:
    action: READ phase-1-overview.md STEP 1 yaml
    verify: phase_id == "1"
  2_prerequisite_verification:
    action: RUN pnpm run phase-0:gate
    gate: exit 0
  3_subphase_selection:
    action: RUN exit_criteria 1.1 → 1.6 per subphases/*.md
  4_DAG_enforcement:
    action: READ phase-1-state-machine.md
    forbid: StepEngine class · fromPlugin · design-tokens during 1.x
  5_gate_execution:
    action: RUN pnpm run phase-1:gate
    bind: g1 g2b g2 g2c g2d g11 g12 g13 g10 g3 g3b g3c g4 g5 g6 g8
  6_audit_generation:
    action: VERIFY reports/phase-1-guard-*.json + PHASE_1_CLOSURE_CONTRACTS 14 rows
  7_next_phase_handoff:
    action: READ phase-1-enforcement.md phase_2_entry_checklist when DONE
```

---

## AGENT EXECUTION ALGORITHM

```yaml
algorithm:
  1: "VERIFY phase_0 DONE — pnpm run phase-0:gate exit 0"
  2: "SET current_subphase from repo by running exit_criteria checks 1.1→1.6"
  3: "IF modifying packages/platform-core OR apps/api THEN update docs/phase-1-platform-core.mdoc FIRST per Zero-Debt Covenant"
  4: "EXECUTE only tasks for current_subphase; 1.4 MUST deliver render-plan.steps NOT StepEngine class"
  5: "FORBIDDEN PlatformWizardEngine.fromPlugin — use tryFromPlugin or create+tryInit"
  6: "AFTER subphase 1.6 OR any platform-core change RUN pnpm run phase-1:gate"
  7: "BIND guards to g1 g2b g2 g2c g2d g11 g12 g13 g10 g3 g3b g3c g4 g5 g6 g8 — never stale g6=report-write from .md"
  8: "IF all phase_2_entry_checklist PASS SET current_subphase DONE"
  9: "APPEND: Architect, documentation status: [Updated/Not Needed]. Link to docs: [URL]"
```

---

## DOC_DRIFT REGISTER (SOURCE MD/Mdoc vs REPO)

```yaml
doc_drift:
  - id: DRIFT-01
    source: "mdoc §4.6 root scripts phase-1:gate JSON omits test:phase-1 step"
    repo: 'package.json phase-1:gate includes pnpm --filter @app-tour/platform-core run test:phase-1 before guards'
    resolution: "Execute package.json chain in CI_PIPELINE section — not mdoc JSON block alone"
  - id: DRIFT-02
    source: "docs/phase-1-platform-core.md §4.6 maps g6 to write reports/phase-1-guard"
    repo: "g6_import_boundary = pnpm run guard:import-boundary in phase-1-guard.mjs"
    resolution: "Use guard ID table in phase_1_guard_checks — g6 is import-boundary AST"
  - id: DRIFT-03
    source: "historical mdoc g13 30% row (retired)"
    repo: "gate-thresholds.mjs PHASE_1_FACADE_TEST_RATIO_MIN = 0.6 enforced by g13 on closure specs"
    resolution: "Enforce 0.6 minimum facade-path share in closure specs (excl. test/unit/**)"
  - id: DRIFT-04
    source: "DAG mermaid P14 label 1.4_step_engine / historical StepEngine naming"
    repo: "render-plan.steps.ts plain functions; step.engine.ts removed from src/"
    resolution: "Subphase 1.4 deliverable = render-plan.steps NOT StepEngine class"
  - id: DRIFT-05
    source: "mdoc §5 / legacy docs PlatformWizardEngine.fromPlugin fail-fast"
    repo: "fromPlugin removed — tryFromPlugin eager; create lazy"
    resolution: "FORBIDDEN fromPlugin — contract no-fromPlugin-api"
  - id: DRIFT-06
    source: "docs/phase-1-platform-core.md stale gate chain and lower test floors"
    repo: "canonical phase-1-platform-core.mdoc + package.json + gate-thresholds.mjs"
    resolution: "REPO_SCRIPTS_OVER_STALE_MD — prefer .mdoc and this ai-exec"
  - id: DRIFT-07
    source: "narrative docs cite test floor 132 / closure 50"
    repo: "gate-thresholds.mjs PLATFORM_CORE_TEST_MIN.phase1=148 CLOSURE=56"
    resolution: "Enforce thresholds from gate-thresholds.mjs not stale md tables"
  - id: DRIFT-08
    source: "md implies Husky ci:integrity equals phase-1:gate"
    repo: "ci-integrity-check.sh runs phase-0:gate + guard:symlink + phase-1-guard.mjs only"
    resolution: "Phase 1 PR closure requires explicit pnpm run phase-1:gate in CI/workflow"
```

---

## FAIL CONDITIONS

```yaml
fail_assessment:
  phase_identification: PASS
  subphase_detection: PASS
  guard_binding: PASS when using package.json + phase-1-guard.mjs + gate-thresholds.mjs
  actionable_steps: PASS with DOC_DRIFT register DRIFT-01 through DRIFT-08

hard_fail_triggers:
  - condition: "Agent runs mdoc §4.6 phase-1:gate JSON without test:phase-1"
    result: FAIL — misses g11 enforcement path in gate chain
  - condition: "Agent implements StepEngine class for subphase 1.4"
    result: FAIL — violates DRIFT-04 and subphase_1_4_naming_law
  - condition: "Agent adds PlatformWizardEngine.fromPlugin"
    result: FAIL — violates DRIFT-05 and no-fromPlugin-api contract
  - condition: "Agent treats g2 ≥148 as sole proof of behavioral closure without g11/g12"
    result: FAIL — violates FT-P1-03
  - condition: "Agent enforces g13 at 30% instead of 0.6"
    result: FAIL — violates DRIFT-03 and gate-thresholds.mjs
  - condition: "Agent enforces platform-core test floor 132 or closure 50 from stale md"
    result: FAIL — violates DRIFT-07; use 148 / 56 from gate-thresholds.mjs
  - condition: "platform-core imports packages/workspaces/* or legacy/"
    result: FAIL — A2 A3 g5
  - condition: "merge without pnpm run phase-1:gate green"
    result: FAIL — A10
  - condition: "Agent uses stale phase-1-platform-core.md gate definition only"
    result: FAIL — DRIFT-06
  - condition: "Agent treats ci:integrity pre-commit pass as phase-1:gate without running phase-1:gate"
    result: FAIL — DRIFT-08 misses test:phase-1 outer step and full guard chain order

conditional_pass:
  - "MAP §14.1 architect sign-off human checkbox open while technical gate green"
  - "Remote phase-1-gate.yml not verified after push unless offline-only task"

verdict: "PASS for AI execution when bound to repo scripts; FAIL if any hard_fail_triggers fire"
binding: REPO_SCRIPTS_OVER_STALE_MD — execute package.json phase-1:gate not mdoc §4.6 JSON alone
```

---

**END AI-EXECUTION DOCUMENT**
