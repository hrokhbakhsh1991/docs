# Phase 3 — Enforcement · Forbidden · DoD · Phase 4 entry

## PHASE 3 ENFORCEMENT — §13 ALL P3-E-* IDs

```yaml
covenant_to_enforcement_MAP_18:
  Safety_First: [P3-E-CASL-01, P3-E-L01]
  Guard_First: "P3-E-* all"
  Honest_Reporting: P3-E-DOC-01
  Artifact_Check: P3-E-ARTIFACT
  Doc_Code_Parity: [P3-E-DOC-01, P3-E-DOC-GATE]

enforcement_table:
  - enforcement_id: P3-E-BARREL
    sub_task: "Any PR touching apps/**"
    ci_command: [pnpm run guard:import-boundary, pnpm run audit-boundary]
    fail_if: "ui-primitives-barrel-import detected"
    guard_ids: [p3_import_boundary, p3_audit_boundary]
  - enforcement_id: P3-E-APP-HOOK
    sub_task: "@apps/web dev/build/lint"
    ci_command: "pnpm --filter @apps/web run lint"
    fail_if: "pre* guards fail"
    guard_ids: [p3_apps_web_lint, p3_web_gate]
  - enforcement_id: P3-E-PRIM-NEW
    sub_task: "New ui-primitive"
    ci_command: [ui-primitives test, P3-E-CSS-01]
    fail_if: "missing wiring spec; barrel . export; dist/tokens/"
  - enforcement_id: P3-E-PRIM-BARREL
    sub_task: "New primitive barrel leakage test"
    ci_command: "audit-ui-primitives-boundary + fixture test"
    fail_if: "forbidden barrel import passes audit"
    pr_text_required: "If new primitive, CI MUST prove zero barrel via P3-E-BARREL + P3-E-PRIM-NEW"
  - enforcement_id: P3-E-CSS-01
    sub_task: "Edit *.module.css primitives"
    ci_command: component-token-maps-wiring.spec.ts + optional dist grep
    fail_if: "forbidden literal patterns"
    invariant: P3-UI-00
  - enforcement_id: P3-E-CSS-02
    sub_task: "Badge/Alert global coupling"
    ci_command: "rg ':global' packages/ui-primitives/src"
    fail_if: "any match"
    invariant: P3-UI-03
  - enforcement_id: P3-E-ARTIFACT
    sub_task: "Publishable package build"
    ci_command: pnpm run guard:artifact-surface
    fail_if: "file outside files whitelist"
    invariant: P3-PKG-01
    guard_id: p3_artifact_surface
  - enforcement_id: P3-E-L01
    sub_task: "theme-react export change"
    ci_command: "pnpm --filter @app-tour/theme-react run verify:exports"
    fail_if: "./internal ./harness stray dist/"
    invariant: P3-THM-01
    guard_id: p3_theme_react_verify_exports
  - enforcement_id: P3-E-WS-01
    sub_task: "New workspace package / starter"
    ci_command: [pnpm run guard:architecture, depcruise starter]
    fail_if: "apps import from workspaces reverse; starter forbidden deps"
    guard_ids: [p3_guard_architecture, p3_starter_build, p3_starter_tests, p3_no_denali]
  - enforcement_id: P3-E-CASL-01
    sub_task: "CASL + theme"
    ci_command: [workspace-sdk tests ≥100, theme-react provider deny test]
    fail_if: "theme DOM without ability pass"
    guard_id: p3_workspace_sdk_tests
  - enforcement_id: P3-E-DB-01
    sub_task: "API DB query / tenant scope"
    ci_command: [phase-3:api-gate, accessibleBy integration tests]
    fail_if: "cross-tenant read"
    guard_ids: [p3_api_gate, p3_apps_api_exists]
  - enforcement_id: P3-E-API-01
    sub_task: "API package boundary"
    ci_command: apps/api/test/package-boundary.spec.ts + depcruise
    fail_if: "ui-primitives or denali in api deps"
  - enforcement_id: P3-E-CANONICAL-34
    sub_task: "canonical-only 3.4"
    ci_command: "pnpm --filter @apps/api run validate:canonical-sync"
    fail_if: "dual-write or legacy write path"
    guard_id: p3_canonical_sync
  - enforcement_id: P3-E-DOC-01
    sub_task: "Phase 3 close / sub-phase seal"
    ci_command: "manual Phase Gate Audit Table + forensic archive"
    fail_if: "audit table not updated; no archived forensic"
  - enforcement_id: P3-E-DOC-GATE
    sub_task: "Docs-as-Code 3.1+"
    ci_command: pnpm run doc-gate
    fail_if: "registry missing; broken links; markdoc fail; audit-boundary fail"
    guard_id: p3_doc_gate
    note: "REPO includes doc-gate in phase-3:gate AND phase-3-guard — stale md §13.4 omits doc-gate"
  - enforcement_id: P3-E-GATE
    sub_task: "Full phase gate"
    ci_command: pnpm run phase-3:gate
    fail_if: "any required p3_* check false"

P3-E-PRIM-BARREL_contract:
  required_one_of:
    - "Guard regression fixture packages/ui-primitives/test/ or scripts/guards/"
    - "apps/web integration proving guard:ui-primitives-boundary in CI"
  existing: audit-ui-primitives-boundary.mjs
```

---

## FORBIDDEN ACTIONS (§14)

```yaml
forbidden_actions:
  - id: F3-01
    forbidden: 'barrel import @app-tour/ui-primitives'
    correct: "subpaths §6.4"
    enforcement: P3-E-BARREL
  - id: F3-02
    forbidden: "@app-tour/theme-react/internal or mapper export"
    correct: "providers + ingress"
    enforcement: P3-E-L01
  - id: F3-03
    forbidden: "static import packages/workspaces/denali"
    correct: "starter only until phase 6"
    enforcement: p3_no_denali
  - id: F3-04
    forbidden: "theme ingress without CASL"
    correct: "§6.3 handoff"
    enforcement: P3-E-CASL-01
  - id: F3-05
    forbidden: "raw Prisma findMany in handlers"
    correct: "accessibleBy + ScopedTourRepository"
    enforcement: [P3-E-DB-01, guard:api-queries]
  - id: F3-06
    forbidden: "dual-write canonical + legacy"
    correct: "3.4 canonical only"
    enforcement: P3-E-CANONICAL-34
  - id: F3-07
    forbidden: "Fully satisfied Security Seal language"
    correct: "Closed Zero-Debt Verified + audit"
  - id: F3-08
    forbidden: "literal CSS in primitive modules"
    correct: "var(--*) only"
    enforcement: P3-E-CSS-01
  - id: F3-09
    forbidden: "dist/** outside files whitelist"
    correct: "prune + artifact guard"
    enforcement: P3-E-ARTIFACT
  - id: F3-10
    forbidden: "skip predev/prebuild/prelint guards in apps/web"
    correct: "always run guard trio"
    enforcement: P3-E-APP-HOOK
  - id: F3-11
    forbidden: "modify platform-core workspace-sdk theme-react ui-primitives without docs-first"
    correct: "docs/phase-3-design-system.mdoc per .cursorrules"
  - id: F3-12
    forbidden: "<input> raw in wizard renderer"
    correct: "subpath primitives registry"
    enforcement: guard:no-raw-wizard-input
```

---

## DEFINITION OF DONE — PHASE 3 (§15)

```yaml
dod_security_seal:
  status: "Closed: Zero-Debt Verified"
  date: "2026-06-03"
  map_ref: MIGRATION-MAP Phase Gate Audit Table §18
  forensic: docs/audits/phase-3-zero-debt-forensic-audit.mdoc
  not: "Fully satisfied without audit"

dod_metrics_required:
  Dist_Leakage: 0
  CSS_Literal_Debt: 0
  Barrel_Import_Violations: 0
  phase_3_gate: PASS
  forensic_archived: "docs/audits/phase-3-*.mdoc"

subphase_gate_status:
  - subphase: "3.0"
    enforcement: P3-E-CASL-01
    security_seal: Verified
    verification: "defineAbilityFor + test/auth/ + ThemeProviderChain deny"
  - subphase: "3.1"
    enforcement: P3-E-WS-01
    security_seal: Verified
  - subphase: "3.2"
    enforcement: P3-E-DB-01
    security_seal: Enforced
  - subphase: "3.3"
    enforcement: [P3-E-BARREL, P3-E-APP-HOOK]
    security_seal: Enforced
    soft_backlog: Playwright
  - subphase: "3.3.x"
    enforcement: [P3-E-PRIM-NEW]
    status: optional_non_blocking
  - subphase: "3.4"
    enforcement: P3-E-CANONICAL-34
    security_seal: Enforced
  - subphase: "3.5"
    enforcement: P3-E-GATE
    security_seal: Enforced

dod_checklist:
  - id: DOD-1
    item: "3.0 CASL + handoff P3-E-CASL-01"
    status: done
  - id: DOD-2
    item: "3.1 starter P3-E-WS-01"
    status: done
  - id: DOD-3
    item: "3.2 apps/api P3-E-DB-01"
    status: done
  - id: DOD-4
    item: "3.3 apps/web P3-E-BARREL P3-E-APP-HOOK"
    status: done
    note: "Playwright optional backlog"
  - id: DOD-5
    item: "3.3.x Select Checkbox P3-UI-01/02"
    status: optional
  - id: DOD-6
    item: "3.4 canonical P3-E-CANONICAL-34"
    status: done
  - id: DOD-7
    item: "3.5 phase-3-gate + report"
    status: done
  - id: DOD-8
    item: "Phase Gate Audit Table row 3 Closed"
    status: done
  - id: DOD-9
    item: "§13 enforcement IDs verified in reports/phase-3-gate-2026-06-03.json"
    status: done

phase_2_items_final_in_phase_3:
  - item: "Button Input FieldShell Alert Badge"
    phase_3: "Maintained P3-E-CSS-01"
  - item: "Select Checkbox"
    phase_3: "P3-UI-01/02 optional p3_ui_select_checkbox_optional"
  - item: "SB-01 SB-03"
    phase_3: "P3-E-L01 regression watch"
  - item: "SB-02"
    phase_3: "P3-E-ARTIFACT"
  - item: "P2-005 CSS"
    phase_3: "P3-E-CSS-01 permanent"

phase_3_complete_when_ALL:
  - current_subphase: DONE
  - pnpm run phase-3:gate: exit 0
  - all_p3_required_guard_checks: PASS
  - forbidden_actions_§14: none violated
  - test_matrix_appendix_F: required rows PASS
  - phase_4_entry_technical: ALL PASS except human tenant design items
```

---

## PHASE 4 ENTRY CHECKLIST (§16)

```yaml
phase_4_entry_checklist:
  items:
    - id: P4E-01
      condition: "phase-3-design-system.md §8–§15 complete"
      status: done
    - id: P4E-02
      condition: "pnpm run phase-3:gate green"
      verify: pnpm run phase-3:gate
      status: done
    - id: P4E-03
      condition: "Forensic Phase 3 archived"
      path: docs/audits/phase-3-zero-debt-forensic-audit.mdoc
      status: done
    - id: P4E-04
      condition: "Tenant subdomain design reviewed MAP §7"
      status: OPEN_HUMAN
    - id: P4E-05
      condition: "RLS migration plan drafted — NOT implemented in Phase 3"
      status: OPEN_HUMAN
  next_phase:
    name: "tenant-kernel + TenantThemeProvider production + RLS"
    document: MIGRATION-MAP phase 4
```

---

## COMPLETION CHECKLIST (PHASE 3 FULL)

```yaml
phase_3_complete_when_ALL:
  - subphase_3_0: ALL EC-30-* PASS
  - subphase_3_1: ALL EC-31-* PASS
  - subphase_3_2: ALL EC-32-* PASS
  - subphase_3_3: ALL EC-33-* required PASS (Playwright optional)
  - subphase_3_4: ALL EC-34-* PASS
  - subphase_3_5: ALL EC-35-* PASS
  - phase_3_gate: pnpm run phase-3:gate exit 0
  - phase_3_guard: all required p3_* PASS in reports/phase-3-gate-*.json
  - phase_2_regression: embedded phase-2:gate PASS
  - doc_gate: p3_doc_gate PASS
  - thresholds:
      workspace_sdk: "≥ 100"
      workspace_starter: "≥ 15"
      apps_api: "≥ 20 via api-gate"
      apps_web: "≥ 10 via web-gate"
  - invariants_P3_UI_P3_SEC_P3_APP: enforced
  - forbidden_actions_§14: none violated
  - test_matrix_G3: PASS
  - forensic: docs/audits/phase-3-zero-debt-forensic-audit.mdoc archived
  - document_status: "Closed: Zero-Debt Verified 2026-06-03"
```

---

