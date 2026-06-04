# Phase 0 — Verification matrix

```yaml
enforcement_matrix:
  - enforcement_id: P0-E-COVENANT
    verification: pnpm run test:phase-0 exit 0
    artifact: packages/workspace-sdk/test/phase-0.contract.spec.ts
    failure_condition: any of 10 covenant subprocess failures
  - enforcement_id: P0-E-ARCH-SCOPED
    guard_id: g4_depcruise_architecture
    verification: depcruise workspace-sdk + config (foundation guard scope)
    failure_condition: forbidden edges in scoped crawl
  - enforcement_id: P0-E-ARCH
    guard_id: g4_depcruise_architecture
    verification: pnpm run guard:architecture
    failure_condition: monorepo depcruise non-zero
  - enforcement_id: P0-E-IMPORT-SCOPED
    guard_id: g4b_import_boundary
    verification: guard:import-boundary foundation roots
    failure_condition: AST boundary violation in foundation scope
  - enforcement_id: P0-E-IMPORT
    guard_id: g4b_import_boundary
    verification: pnpm run guard:import-boundary full roots
    failure_condition: barrel or forbidden import detected
  - enforcement_id: P0-E-DOC
    guard_id: g7_doc_sync
    verification: DOC_SYNC_SCOPE=foundation pnpm run guard:doc-sync
    failure_condition: phase 0 registry/markdoc/README mismatch
  - enforcement_id: P0-E-RUNTIME
    guard_id: g6_runtime_deps_honesty
    verification: ui-primitives package.json dependencies vs src imports
    failure_condition: undeclared react/react-dom/@app-tour/* in src
  - enforcement_id: P0-E-BASELINE
    verification: pnpm run baseline:metrics exit 0
    artifact: reports/phase-0-baseline-*.json
    failure_condition: t2 or t3 contract fail
  - enforcement_id: P0-E-CI
    verification: pnpm run phase-0:gate exit 0
    failure_condition: foundation OR integration step fails
  - enforcement_id: P0-E-LEGACY
    verification: test -d legacy/apps/api && test -f legacy/README.md
    failure_condition: legacy tree missing
```
