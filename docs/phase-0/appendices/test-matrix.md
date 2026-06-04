# Appendix — Test matrix (Phase 0)

```yaml
foundation_gate:
  command: pnpm run test:phase-0
  enforcement_id: P0-E-COVENANT
  aggregator: packages/workspace-sdk/test/phase-0.contract.spec.ts

covenant_modules:
  - { id: dist-surface, gate: subprocess contract.spec.ts }
  - { id: denali-coupling, gate: denali-coupling.contract.spec.ts }
  - { id: legacy-import, gate: legacy-import.contract.spec.ts }
  - { id: invariant-manifest, gate: invariant-manifest.contract.spec.ts }
  - { id: import-purity, gate: import-purity.spec.ts }
  - { id: ingress-error, gate: ingress-error.contract.spec.ts }
  - { id: theme-safety-seal, gate: theme-safety-seal.contract.spec.ts }
  - { id: foundation-import-purity, gate: foundation-import-purity.contract.spec.ts }
  - { id: denali-workspace-binding, gate: denali-workspace-binding.contract.spec.ts }
  - { id: supplemental-behavior, gate: phase-0-supplemental.contract.spec.ts }

integration_gate:
  - { step: build, command: pnpm build }
  - { step: test, command: pnpm test }
  - { step: contract_monorepo, command: pnpm run test:contract:monorepo }
  - { step: adversarial, command: pnpm run test:adversarial }
  - { step: doc_sync, command: DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync }
  - { step: phase_0_guard_foundation_scope, command: PHASE_0_GUARD_SCOPE=foundation node scripts/guards/phase-0-guard.mjs }
  - { step: architecture, command: pnpm run guard:architecture }
  - { step: import_boundary, command: pnpm run guard:import-boundary }
  - { step: baseline, command: pnpm run baseline:metrics, enforcement_id: P0-E-BASELINE }

baseline_metrics_enforced:
  - id: t2_denali_coupling_contract
    source: denali-coupling.contract.spec.ts via baseline-metrics.mjs
  - id: t3_legacy_import_contract
    source: legacy-import.contract.spec.ts via baseline-metrics.mjs

informational_only:
  - workspace_sdk_test_count_floor_103: REMOVED — outdated (DRIFT-03)
```
