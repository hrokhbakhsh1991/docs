# Phase 0 baseline — 2026-06-14

- **Generated:** 2026-06-14T20:31:16.073Z
- **Git SHA:** `3514fd12`
- **JSON:** [reports/phase-0-baseline-2026-06-14.json](reports/phase-0-baseline-2026-06-14.json)

## Summary metrics

| Metric | Value |
|--------|-------|
| workspace_sdk_test_it_source (informational) | 186 |
| workspace_sdk_export_count | 4 |
| workspace_sdk_source_files | 83 |
| denali_coupling_contract_ok | true |
| legacy_import_contract_ok | true |
| new_packages | config, design-tokens, draft-engine, platform-core, platform-events, tenant-kernel, theme-react, ui-primitives, wizard-navigation, workspace-sdk, workspaces |

## Per-layer denali (foundation contract scope)

| Layer | enforced | source |
|-------|----------|--------|
| `packages/config` | yes | denali-coupling.contract.spec.ts |
| `packages/workspace-sdk` | yes | denali-coupling.contract.spec.ts |
| `packages/platform-core` | no | outside foundation scan |
| `packages/workspaces` | no | outside foundation scan |

## Threshold checks

| ID | Expected | Actual | Result |
|----|----------|--------|--------|
| t2_denali_coupling_contract | denali-coupling.contract.spec.ts PASS | true | PASS |
| t3_legacy_import_contract | legacy-import.contract.spec.ts PASS | true | PASS |

## Phase 0.6 exit

- **Phase 0.6 baseline:** PASS

> Regression: re-run `pnpm run baseline:metrics` after structural PRs; compare JSON gitSha.
