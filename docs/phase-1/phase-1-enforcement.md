# Phase 1 — Enforcement

## FORBIDDEN ACTIONS (§8)

```yaml
forbidden_actions:
  - forbidden: apps/api
    correct_phase: "3"
  - forbidden: apps/web
    correct_phase: "3"
  - forbidden: packages/design-tokens
    correct_phase: "2"
  - forbidden: packages/workspaces/*
    correct_phase: "3+"
  - forbidden: React components in platform-core
    correct_phase: "2–3 ui-primitives"
  - forbidden: Denali port
    correct_phase: "6"
  - forbidden: DB migrations
    correct_phase: "5"
  - forbidden: WorkspaceThemeContract in platform-core
    correct_phase: "2.2 — SDK + theme-react"
  - forbidden: copy legacy DenaliFieldRenderer
    correct_phase: "6"
  - forbidden: HTTP / Nest in platform-core
    correct_phase: "3"
  - forbidden: PlatformWizardEngine.fromPlugin
    correct_api: "tryFromPlugin OR create + tryInit"
    enforcement: no-fromPlugin-api contract + FT-P1-02
  - forbidden: class StepEngine in src/
    correct_artifact: render-plan.steps functions
    subphase: "1.4"
  - forbidden: getFieldEngine getRuleEngine getStepEngine on public facade
  - forbidden: "@app-tour/platform-core/engine/* subpath imports from apps"
  - forbidden: import packages/workspaces/* from platform-core
    enforcement: [A2, g5]
  - forbidden: import legacy/
    enforcement: [A3, g5]
  - forbidden: dual state form + canonical
    rule: A7
  - forbidden: modify platform-core without docs-first Markdoc per .cursorrules
```

---

## DEFINITION OF DONE — PHASE 1 (§9)

```yaml
dod_delivered_verified:
  - "@app-tour/platform-core in root pnpm build chain"
  - "platform-core tests ≥ 148 pass — gate-thresholds.mjs PLATFORM_CORE_TEST_MIN.phase1"
  - "PlatformWizardEngine.create / tryFromPlugin / tryInit with starter plugin"
  - "rg -i denali packages/platform-core excl specs → 0 — g3"
  - "depcruise platform-core-no-workspaces platform-core-only-sdk no-legacy-imports"
  - "CI phase-1-gate.yml → pnpm run phase-1:gate"
  - "reports/phase-1-guard-*.json on gate run"
  - "engine only in packages/platform-core — apps phase 3"

dod_closure_covenant_MAP_14_1:
  - "phase-1-platform-core.mdoc DF remediated guard:doc-sync green"
  - "brutal audit maturity 95/100 technical — reports/phase-1-brutal-audit-2026-06-03.md"
  - "pnpm run phase-1:guard green g1-g6 g8 g10-g13 g3b g3c"
  - "apps import facade only — depcruise apps-no-platform-core-src-deep-import"
  - open_human: "MAP §14.1 architect sign-off — reports/phase-1-closure-readiness-2026-06-03.md"

phase_1_complete_when_ALL:
  - current_subphase: DONE
  - pnpm run phase-1:gate: exit 0
  - all_phase_1_guard_checks: PASS
  - PHASE_1_CLOSURE_CONTRACTS: 14 rows each with guardIds
  - anti_patterns_A1_A10: all false
  - forbidden_actions: none violated
  - PlatformWizardEngine.fromPlugin: absent in production src
```

---

## PHASE 2 ENTRY CHECKLIST (§10)

```yaml
phase_2_entry_checklist:
  all_must_pass: true
  items:
    - id: P2E-01
      condition: "pnpm run phase-1:gate exit 0"
      verify: pnpm run phase-1:gate
    - id: P2E-02
      condition: "platform-core tests ≥ 148"
      verify: "g2_platform_core_test_count PASS per gate-thresholds.mjs"
    - id: P2E-03
      condition: "g11 ≥ 14 contract behaviors"
      verify: pnpm --filter @app-tour/platform-core run test:phase-1
    - id: P2E-04
      condition: "g13 facade ratio ≥ 60%"
      verify: "reports/phase-1-guard g13_facade_test_ratio PASS"
    - id: P2E-05
      condition: "no denali no react in platform-core"
      verify: [g3_no_denali_tokens, g4_no_react_imports]
    - id: P2E-06
      condition: "RenderPlan headless exists — buildRenderPlan"
      verify: test/unit/engine/render-plan.spec.ts green
    - id: P2E-07
      condition: "WorkspaceThemeContract in SDK shipped for phase 2 consumers"
      verify: packages/workspace-sdk/src/theme/ exists
    - id: P2E-08
      condition: "docs phase-2-design-system.mdoc exists"
      verify: test -f docs/phase-2-design-system.mdoc
    - id: P2E-09
      condition: "did NOT start design-tokens implementation during phase 1 subphases"
      verify: "process review — forbidden §8"

on_all_pass:
  next_document: docs/phase-2-design-system.mdoc
  next_section: "Phase 2.1 packages/design-tokens"
  pipeline_note: |
    Phase 1: RenderPlan headless kind + path
    Phase 2: tokens visual semantics
    Phase 3: ui-primitives consume plan + tokens
    Phase 6: denali widgets as composite resolvers in plugin
```

---

## COMPLETION CHECKLIST (PHASE 1 FULL)

```yaml
phase_1_complete_when_ALL:
  - subphase_1_1: ALL EC-11-* PASS
  - subphase_1_2: ALL EC-12-* PASS
  - subphase_1_3: ALL EC-13-* PASS
  - subphase_1_4: ALL EC-14-* PASS AND no StepEngine class in src
  - subphase_1_5: ALL EC-15-* PASS
  - subphase_1_6: ALL EC-16-* PASS
  - phase_1_gate: pnpm run phase-1:gate exit 0
  - phase_1_guard: all g1 g2b g2 g2c g2d g11 g12 g13 g10 g3 g4 g5 g6 g8 PASS
  - thresholds:
      platform_core: "≥ 148"
      closure: "≥ 56"
      workspace_sdk: "≥ 39"
      g11_contracts: "≥ 14"
      g13_ratio: "≥ 0.6"
  - PHASE_1_CLOSURE_CONTRACTS: 14 ids listed
  - anti_patterns_A1_A10: all false
  - forbidden_actions_§8: none violated
  - fromPlugin: absent
  - phase_2_entry_checklist: ALL PASS
  - doc_sync: "if protected code touched — phase-1-platform-core.mdoc updated first"
```

---

