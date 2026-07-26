# Phase 0 baseline — 2026-07-13

- **Generated:** 2026-07-13T23:03:34.700Z
- **Git SHA:** `d6d4f8e1`
- **JSON:** [reports/phase-0-baseline-2026-07-13.json](reports/phase-0-baseline-2026-07-13.json)

## Summary metrics

| Metric | Value |
|--------|-------|
| workspace_sdk_test_it_source (informational) | 328 |
| workspace_sdk_export_count | 4 |
| workspace_sdk_source_files | 166 |
| denali_coupling_contract_ok | true |
| legacy_import_contract_ok | true |
| new_packages | catalog-intake-ui, catalog-registration-auth, catalog-registration-flow-ui, config, design-tokens, draft-engine, guest-surface-host, platform-core, platform-events, session-client, tenant-kernel, theme-react, ui-primitives, wizard-navigation, workspace-plugin-host, workspace-sdk, workspaces |

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
