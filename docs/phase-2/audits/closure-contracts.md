# Phase 2 — Closure contracts (behavioral)

## PHASE_2_CLOSURE_CONTRACTS (8 rows — repo truth)

```yaml
closure_contracts_source: packages/platform-core/test/phase-2.contract.spec.ts
PHASE_2_MIN_BEHAVIOR_CONTRACTS: 8
guard_id: p2_phase2_contract_behaviors
contracts:
  - id: no-ui-primitives-barrel-export
    title: "ui-primitives package.json has no barrel export (.)"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors, p2_ui_primitives_no_barrel]
  - id: no-theme-react-internal-export
    title: "theme-react must not export ./internal"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors, p2_theme_react_no_internal_export]
  - id: platform-core-no-design-tokens
    title: "platform-core must not reference design-tokens"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors, p2_platform_core_no_tokens]
  - id: platform-core-no-visual-package-deps
    title: "platform-core package.json has no ui-primitives or theme-react deps"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors]
  - id: no-barrel-ui-primitives-imports
    title: "packages and apps must not import @app-tour/ui-primitives barrel"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors]
  - id: theme-react-index-no-harness-leak
    title: "theme-react public index.ts does not re-export harness"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors, p2_theme_react_export_allowlist_l01]
  - id: workspace-sdk-theme-css-safety
    title: "SDK theme CSS safety + theme-react validateWorkspaceThemeIngress"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors]
  - id: theme-react-single-public-export
    title: "theme-react exports only root entry (.)"
    specRel: test/phase-2.contract.spec.ts
    guardIds: [p2_phase2_contract_behaviors, p2_theme_react_export_allowlist_l01]
enforcement: "pnpm --filter @app-tour/platform-core run test:phase-2"
ci_integrity: "pnpm run phase-2:gate after phase-1 delta in scripts/ci-integrity-check.sh"
```

---
