# Phase 2 — Enforcement, Forbidden, DoD & Phase 3 Entry

## FORBIDDEN ACTIONS (§12)

```yaml
forbidden_actions:
  - id: F2-00
    forbidden: 'barrel import @app-tour/ui-primitives'
    correct: "subpaths only §5.6"
    enforcement: [guard:import-boundary, audit-boundary, p2_ui_primitives_no_barrel]
  - id: F2-01
    forbidden: apps/api
    correct_phase: "3"
  - id: F2-02
    forbidden: Postgres in phase 2
    correct_phase: "3"
  - id: F2-03
    forbidden: packages/workspaces/denali
    correct_phase: "6"
  - id: F2-04
    forbidden: "full wizard + RHF canonical dual-write"
    correct_phase: "3"
  - id: F2-05
    forbidden: "modify RuleEngine / validateCanonical behavior"
    correct_phase: "1 frozen"
  - id: F2-05b
    forbidden: "platform-core → design-tokens / ui-primitives dependency"
    correct_phase: "downstream-only visual"
    enforcement: p2_platform_core_no_tokens
  - id: F2-06
    forbidden: "static workspace import in shell"
    correct_phase: "3 dynamic bootstrap"
  - id: F2-07
    forbidden: Tailwind in primitives
    correct: "CSS Modules + vars"
  - id: F2-08
    forbidden: "production Vazirmatn font in package"
    correct_phase: "3 apps/web next/font"
  - id: F2-09
    forbidden: Module Federation marketplace
    correct_phase: "7+ evaluate"
  - id: F2-10
    forbidden: "@app-tour/theme-react/internal export or import"
    enforcement: p2_theme_react_no_internal_export
    forensic: SB-01
  - id: F2-11
    forbidden: "theme-react exports beyond ."
    enforcement: p2_theme_react_export_allowlist_l01
  - id: F2-12
    forbidden: "read legacy/scripts/validate-design-tokens.js or docs/10-product/design_system.md for guard SoT"
    correct: packages/design-tokens/tokens.meta.json
  - id: F2-13
    forbidden: "CASL-only OR ingress-only security in phase 3 runtime"
    correct: "both layers — CASL before ingress"
  - id: F2-14
    forbidden: modify design-tokens/ui-primitives/theme-react without docs-first Markdoc per .cursorrules
    correct: docs/phase-2-design-system.mdoc first
```

---

## DEFINITION OF DONE — PHASE 2 (§13)

```yaml
dod_security_seal:
  status: "Satisfied via restricted subpath exports"
  not: "Fully satisfied (archived SB-01 breach)"
  map_ref: MIGRATION-MAP Security & Compliance + Audit & Remediation History

dod_delivered_verified:
  - "@app-tour/design-tokens CSS light/dark + semantics + tokens.meta.json"
  - "@app-tour/ui-primitives Button Input FieldShell Alert Complete"
  - "WorkspaceThemeContract + SDK validation"
  - "@app-tour/theme-react provider chain + L-01 verify:exports"
  - "phase-2:gate green — reports/phase-2-gate-*.json"
  - "depcruise rules for new packages"
  - "platform-core + workspace-sdk regression — PC-1 ≥148 (PLATFORM_CORE_TEST_MIN.phase1)"
  - "zero denali in design-tokens ui-primitives theme-react src"
  - "RenderPlan → primitive mapping §5.4 documented"

dod_backlog_not_complete_not_gate_blockers:
  - id: P2-006
    topic: "rgba in --shadow-* in primitives.css"
    status: BACKLOG_ACCEPTED
  - id: Select
    status: BACKLOG phase 3
  - id: Checkbox
    status: BACKLOG phase 3

dod_remediated_audit_items:
  - P2-001
  - P2-002
  - P2-003
  - P2-004
  - P2-005
  - P2-007
  - P2-008
  - SB-01
  - SB-02
  - SB-03

phase_2_complete_when_ALL:
  - current_subphase: DONE
  - pnpm run phase-2:gate: exit 0
  - all_p2_guard_checks: PASS
  - anti_patterns_V1_V7: all false
  - forbidden_actions_§12: none violated
  - test_matrix_G1: PASS
  - thresholds:
      workspace_sdk: "≥ 50"
      ui_primitives: "≥ 12"
      theme_react: "≥ 4"
      visual: "≥ 4"
```

---

## PHASE 3 ENTRY CHECKLIST (§14)

```yaml
phase_3_entry_checklist:
  all_technical_must_pass: true
  items:
    - id: P3E-01
      condition: "phase-2-design-system.mdoc subphases 2.1–2.5 hard outputs + exit criteria aligned §13"
      verify: guard:doc-sync
    - id: P3E-02
      condition: "pnpm run phase-2:gate exit 0"
      verify: pnpm run phase-2:gate
    - id: P3E-03
      condition: "pnpm run phase-1:gate exit 0 — platform-core ≥148 per gate-thresholds.mjs"
      verify: pnpm run phase-1:gate
    - id: P3E-04
      condition: "phase-1 technical DoD §10.1–10.2 + phase-1-guard closure"
      verify: reports/phase-1-closure-readiness-*.md
    - id: P3E-05
      condition: "MAP §14.1 architect sign-off (A1)"
      status: OPEN_HUMAN
      note: "sole official blocker for Phase 1 Complete label — not phase-2 gate"
    - id: P3E-06
      condition: "starterWorkspacePlugin optional theme — platform-primary preset"
      verify: workspace-sdk reference/starter-workspace.plugin.ts
    - id: P3E-07
      condition: "team agreement phase 3 = packages/workspaces/starter + apps/web + apps/api"
      verify: MIGRATION-MAP §11
    - id: P3E-08
      condition: "no raw input in wizard shell — ESLint + guard-no-raw-wizard-input.mjs"
      verify: apps/web/scripts/guard-no-raw-wizard-input.mjs
    - id: P3E-09
      condition: "CASL ability.ts + WorkspaceThemeProvider authz before ingress"
      verify: packages/workspace-sdk/src/auth/ability.ts + theme-react providers.spec.tsx
    - id: P3E-10
      condition: "accessibleByTourWhere + prisma-accessible-by reference tests"
      verify: apps/api test/casl/

on_all_technical_pass:
  next_document: docs/phase-3-design-system.md / MIGRATION-MAP phase 3
  next_subphase: "3.0 CASL then 3.1 starter workspace"
  pipeline_note: |
    Phase 2: what CSS may enter subtree (ingress guard)
    Phase 3: what actor may apply that CSS (CASL) + starter apps
```

---

## COMPLETION CHECKLIST (PHASE 2 FULL)

```yaml
phase_2_complete_when_ALL:
  - subphase_2_1: ALL EC-21-* PASS
  - subphase_2_2: ALL EC-22-* PASS
  - subphase_2_2_1: ALL EC-221-* PASS
  - subphase_2_3: ALL EC-23-* PASS
  - subphase_2_4: ALL EC-24-* PASS
  - subphase_2_5: ALL EC-25-* PASS
  - phase_2_gate: pnpm run phase-2:gate exit 0
  - phase_2_guard: all p2_* PASS in reports/phase-2-gate-*.json
  - thresholds:
      workspace_sdk: "≥ 50"
      ui_primitives: "≥ 12"
      theme_react: "≥ 4"
      visual: "≥ 4"
  - forensic_remediation: [SB-01, SB-02, SB-03]
  - anti_patterns_V1_V7: all false
  - forbidden_actions_§12: none violated
  - theme_rules_T_1_T_7: enforced in SDK tests
  - test_matrix_DT_1_through_G_1: PASS
  - platform_core_regression: "≥ 148 — phase-1 floor per gate-thresholds.mjs"
  - phase_3_entry_technical: ALL PASS except P3E-05 human sign-off
  - doc_sync: "if protected visual code touched — phase-2-design-system.mdoc updated first"
```
