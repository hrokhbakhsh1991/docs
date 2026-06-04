# AI-EXECUTION DOCUMENT — Phase 0 (canonical index)

**Modular layout:** [`README.md`](README.md)

```yaml
document_meta:
  source_file: docs/phase-0-foundation.md
  canonical_markdoc: docs/phase-0-foundation.mdoc
  transformation_version: "2026-06-03"
  execution_priority: REPO_SCRIPTS_OVER_STALE_MD_WHERE_DOC_DRIFT
  ai_exec_index: docs/phase-0/phase-0.ai-exec.index.md
  ai_exec_modules: docs/phase-0/
  modular_split_version: "2026-06-04"
  quality_enhancement: "2026-06-04"
  quality_report: docs/phase-0/QUALITY-VALIDATION.md
  quality_pass_date: "2026-06-04"
  central_stub: docs/phase-0-foundation.ai-exec.md
  phase_id: "0"
  phase_name: "Foundation & Contract (workspace-sdk)"
  subphases: ["0.1", "0.2", "0.3", "0.4", "0.5", "0.6"]
  phase_detection_blocker: null
```

---

## STEP 1 — PHASE DETECTION

```yaml
phase_id: "0"
phase_name: "Foundation & Contract (workspace-sdk)"
prerequisite_phase: none
prerequisite_gate: none
closure_command: pnpm run phase-0:gate
phase_detection_blocker: null
detected_from: phase-0-overview.md STEP 1
```

---

## Module map

| Section | File |
|---------|------|
| STEP 1 | [`phase-0-overview.md`](phase-0-overview.md) |
| STATE · DAG | [`phase-0-state-machine.md`](phase-0-state-machine.md) |
| Forensic truth | [`audits/forensic-template.md`](audits/forensic-template.md) |
| §1–§3 · L-1..L-10 | [`phase-0-overview.md`](phase-0-overview.md) |
| Subphase 0.1–0.6 | [`subphases/`](subphases/) |
| Guards · covenant | [`phase-0-guards.md`](phase-0-guards.md) |
| CI | [`phase-0-ci.md`](phase-0-ci.md) |
| Enforcement | [`phase-0-enforcement.md`](phase-0-enforcement.md) |
| Verification matrix | [`audits/verification-matrix.md`](audits/verification-matrix.md) |
| Quality validation | [`QUALITY-VALIDATION.md`](QUALITY-VALIDATION.md) |
| Appendices A–E + legacy/MAP | [`appendices/`](appendices/) |

---

## AGENT_START_SEQUENCE

```yaml
AGENT_START_SEQUENCE:
  1_phase_detection:
    action: READ phase-0-overview.md STEP 1 yaml
    verify: phase_id == "0"
  2_prerequisite_verification:
    action: NONE — greenfield phase 0 entry
  3_subphase_selection:
    action: RUN exit_criteria 0.1 → 0.6 per subphases/*.md
  4_DAG_enforcement:
    action: READ phase-0-state-machine.md
    forbid: platform-core before 0.6 · legacy import · multi-subphase PR
  5_gate_execution:
    action: RUN pnpm run phase-0:gate
    bind: test:phase-0 + g4 g4b g6 g7 — not stale g1 g2 g3 g5
  6_audit_generation:
    action: VERIFY reports/phase-0-gate-*.json and phase-0-baseline-*.json
  7_next_phase_handoff:
    action: READ phase-0-enforcement.md phase_1_entry_checklist when DONE
```

---

## AGENT EXECUTION ALGORITHM

```yaml
algorithm:
  1: "SET current_subphase from repo state by running exit criteria checks bottom-up"
  2: "IF modifying protected paths THEN update docs/*.mdoc FIRST per Zero-Debt Covenant"
  3: "EXECUTE only actions for current_subphase"
  4: "AFTER code change RUN pnpm run phase-0:gate"
  5: "IF subphase 0.6 OR completion RUN pnpm run baseline:metrics"
  6: "IF all phase_1_entry_checklist PASS SET current_subphase DONE and OPEN phase-1-platform-core.md Phase 1.1"
  7: "APPEND to response: Architect documentation status Updated or Not Needed with docs link"
```

---

## DOC_DRIFT REGISTER

```yaml
doc_drift:
  - id: DRIFT-01
    source: "§9.2 gate step list includes baseline:metrics inside phase-0:gate"
    repo: "baseline:metrics final step of phase-0:integration-gate"
    resolution: "Fixed in package.json — runs via pnpm run phase-0:gate"
  - id: DRIFT-02
    source: "§9.3 g1 g2 g3 g5 guard IDs"
    repo: "phase-0-guard.mjs uses g4 g4b g6 g7 + covenant contracts"
    resolution: "Use covenant list + phase-0-guard checks above"
  - id: DRIFT-03
    source: "§6.10 114 tests ≥103 floor"
    repo: "foundation gate uses behavioral contracts not count floor"
    resolution: "test:phase-0 PASS required; count informational"
  - id: DRIFT-04
    source: "§9.2 single workflow step pnpm run phase-0:gate"
    repo: "CI split foundation-gate + integration-gate jobs"
    resolution: "Both jobs MUST pass for remote parity"
  - id: DRIFT-05
    source: "§9.5 remote GitHub unchecked"
    resolution: "Agent MUST verify remote CI unless explicitly offline-only task"
  - id: DRIFT-06
    source: "ai-exec count 8 covenant"
    repo: "10 modules in phase-0.contract.spec.ts"
    resolution: "Fixed 2026-06-03 — denali-workspace-binding + supplemental-behavior"
  - id: DRIFT-07
    source: "EC-01-1 apps forbidden at root"
    repo: "apps/* exist — Integration Foundation"
    resolution: "EC-01-1-strict FAIL_BY_DESIGN; EC-01-1-integration PASS"
  - id: DRIFT-08
    source: "integration-gate yaml without test:adversarial"
    repo: "package.json phase-0:integration-gate includes test:adversarial"
    resolution: "Fixed in ai-exec repo_scripts_canonical"
  - id: DRIFT-09
    source: "narrative §9.3 lists g_invariant_manifest as separate guard run"
    repo: "phase-0-guard.mjs main() runs g4 g4b g6 g7 only; invariants via invariant-manifest covenant in test:phase-0"
    resolution: "Do not require standalone test:invariants in phase-0:gate — covenant authoritative"
  - id: DRIFT-10
    source: "Agent assumes ci:integrity equals phase-0:gate only"
    repo: "ci-integrity-check.sh adds guard:symlink + phase-1-guard after phase-0:gate"
    resolution: "Full pre-commit = ci:integrity; phase closure = phase-0:gate"
```

---

## FAIL CONDITIONS

```yaml
fail_assessment:
  phase_identification: PASS
  subphase_detection: PASS
  guard_binding: PASS when using package.json + phase-0-guard.mjs + test:phase-0
  actionable_steps: PASS with DOC_DRIFT register DRIFT-01 through DRIFT-10

hard_fail_triggers:
  - condition: "Agent enforces g1 g2 g3 g5 from stale §9.3 without covenant contracts"
    result: FAIL — DRIFT-02
  - condition: "Agent blocks on test count ≥103 without test:phase-0 PASS"
    result: FAIL — DRIFT-03
  - condition: "Agent runs only foundation-gate for full phase-0 closure"
    result: FAIL — misses integration-gate DRIFT-04
  - condition: "Agent starts platform-core before 0.6 baseline PASS"
    result: FAIL — DAG forbidden_overlap
  - condition: "Agent imports legacy/ into packages/"
    result: FAIL — L-2 + forbidden_actions
  - condition: "Agent requires test:invariants in integration-gate outside test:phase-0"
    result: FAIL — DRIFT-09 covenant covers invariant-manifest
  - condition: "Agent treats ci:integrity pass as sufficient without phase-0:gate when closing Phase 0"
    result: FAIL — must run phase-0:gate explicitly for phase closure

conditional_pass:
  - "P1E-05 remote GitHub unchecked in doc — verify workflow both jobs when closing Phase 0"

verdict: "PASS for AI execution when bound to repo scripts; FAIL if hard_fail_triggers fire"
binding: REPO_SCRIPTS_OVER_STALE_MD — execute package.json phase-0:gate not narrative §9 JSON alone
```
