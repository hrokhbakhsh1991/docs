# Phase 2 — CI & Gates

## CI PIPELINE — phase-2:gate CANONICAL CHAIN (package.json REPO TRUTH)

```yaml
phase_2_gate:
  name: pnpm run phase-2:gate
  source: package.json scripts.phase-2:gate
  steps_ordered:
    - step: 1
      run: pnpm build
      includes:
        - "@app-tour/design-tokens dist"
        - "@app-tour/ui-primitives subpath dist"
        - "@app-tour/theme-react dist"
        - platform-core + workspace-sdk via root build chain
      postbuild_hook: "pnpm run guard:artifact-surface runs after build via postbuild"
    - step: 2
      run: pnpm test
      includes: "monorepo package tests — platform-core regression PC-1"
    - step: 3
      run: pnpm run guard:architecture
      validates:
        - design-tokens-isolated
        - design-tokens-no-workspaces
        - design-tokens-no-apps
        - ui-primitives-only-design-tokens
        - ui-primitives-no-workspaces
        - theme-react-allowed-deps
        - theme-react-no-workspaces
        - platform-core-no-workspaces
        - no-legacy-imports
    - step: 4
      run: pnpm run guard:import-boundary
      validates: "AST — no @app-tour/ui-primitives barrel (P3-E-BARREL)"
    - step: 5
      run: pnpm run validate-design-tokens
      script: scripts/guards/validate-design-tokens.mjs
      guard_id: p2_validate_design_tokens
      note: "Also re-run inside phase-2:guard — intentional duplicate"
    - step: 6
      run: pnpm run guard:artifact-surface
      script: scripts/guards/artifact-surface-guard.mjs
      guard_id: p2_artifact_surface_guard
      remediation: SB-02
    - step: 7
      run: pnpm run audit-boundary
      script: scripts/guards/audit-ui-primitives-boundary.mjs
      note: "Also invoked inside p2_ui_primitives_no_barrel"
    - step: 8
      run: pnpm run phase-2:guard
      expands_to: node scripts/phase-2-guard.mjs → scripts/guards/phase-2-guard.mjs
      writes: reports/phase-2-gate-YYYY-MM-DD.json

phase_2_gate_NOT_in_repo_chain:
  - guard:symlink
  note: "Stale mdoc §11.1 and Appendix G JSON list guard:symlink — REPO omits it"

github_workflow:
  file: .github/workflows/phase-2-gate.yml
  node: "24 from .nvmrc"
  steps:
    - checkout
    - pnpm/action-setup@v4
    - actions/setup-node@v4 cache pnpm
    - node scripts/guards/check-node-engine.mjs
    - pnpm install --frozen-lockfile
    - pnpm run phase-2:gate
    - upload reports/phase-2-gate-*.json

gate_order_relative:
  - "phase-1:gate green before starting phase 2.1"
  - "Phase 2 PRs 2.1–2.4: build + targeted tests per subphase"
  - "From PR 2.5+: phase-2:gate required in CI"

pr_policy:
  title_body_label: "Phase: 2.x"
  one_subphase_per_pr: true
  merge_blocked_when:
    - phase-2-guard red
    - any anti-pattern V1–V7 true
    - barrel import detected
```

---

## APPENDIX G — phase-2:gate REPO vs STALE DOC (§17.G)

```yaml
appendix_G_repo_truth:
  package_json_scripts:
    validate-design-tokens: node scripts/guards/validate-design-tokens.mjs
    guard:artifact-surface: node scripts/guards/artifact-surface-guard.mjs
    audit-boundary: node scripts/guards/audit-ui-primitives-boundary.mjs
    phase-2:guard: node scripts/phase-2-guard.mjs
    phase-2:gate: |
      pnpm build &&
      pnpm test &&
      pnpm run guard:architecture &&
      pnpm run guard:import-boundary &&
      pnpm run validate-design-tokens &&
      pnpm run guard:artifact-surface &&
      pnpm run audit-boundary &&
      pnpm run phase-2:guard

  stale_md_appendix_G_json:
    claimed_chain: "build + test + guard:architecture + guard:import-boundary + guard:symlink + phase-2:guard"
    missing_in_stale: [validate-design-tokens, guard:artifact-surface, audit-boundary]
    extra_in_stale: [guard:symlink]
    wrong_guard_table: "numbered checks 1-10 without p2_* ids"
    wrong_workspace_sdk_floor: "133 monorepo min in table narrative"
    correct_workspace_sdk_floor: 50
    wrong_phase_2_guard_path_in_mdoc: "node scripts/guards/phase-2-guard.mjs direct"
    correct_package_json: "node scripts/phase-2-guard.mjs delegates to guards/"

  phase_2_guard_checks_use_p2_ids:
    - p2_design_tokens_dist
    - p2_validate_design_tokens
    - p2_ui_primitives_dist
    - p2_ui_primitives_no_barrel
    - p2_artifact_surface_guard
    - p2_theme_react_dist
    - p2_workspace_sdk_tests
    - p2_ui_primitives_tests
    - p2_theme_react_tests
    - p2_visual_regression
    - p2_no_denali
    - p2_theme_react_export_allowlist_l01
    - p2_theme_react_no_internal_export
    - p2_platform_core_no_tokens

  report_output:
    path: reports/phase-2-gate-YYYY-MM-DD.json
    fields: [generatedAt, gitSha, phase, checks, exit]
    phase_field_value: "2.5"
```
