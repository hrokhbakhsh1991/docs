# Phase 4 — Guards & CI

## GUARDS — phase-4-guard.mjs (§14.2)

```yaml
phase_4_guard_entrypoint:
  package_json: "node scripts/guards/phase-4-guard.mjs"
  alias: pnpm run phase-4:guard
  env: "PHASE_4_GATE_REPORT=YYYY-MM-DD optional slug"
  report: reports/phase-4-gate-YYYY-MM-DD.json

thresholds_file: scripts/guards/gate-thresholds.mjs
TENANT_KERNEL_TEST_MIN_phase4: 6
PLATFORM_EVENTS_TEST_MIN_phase4: 2

phase_4_guard_checks_execution_order:
  - id: p4_red_flag_prerequisite
    enforcementId: P4-E-RF-40
    verify: reports/phase-3.2-red-flag-status-*.md exists (any date slug)
  - id: p4_tenant_kernel_build
    command: pnpm --filter @app-tour/tenant-kernel run build
  - id: p4_tenant_kernel_test
    enforcementId: P4-E-HOST-01
    command: pnpm --filter @app-tour/tenant-kernel run test
    threshold: 6
  - id: p4_platform_events_build
    command: pnpm --filter @app-tour/platform-events run build
  - id: p4_platform_events_test
    enforcementId: P4-E-EVT-01
    command: pnpm --filter @app-tour/platform-events run test
    threshold: 2
  - id: p4_contract_spec
    command: pnpm --filter @app-tour/tenant-kernel run test:phase-4
    note: P4-E-HOST-01 + P4-E-RLS-02 contract rows
  - id: p4_no_denali_in_kernel
    command: rg -i denali packages/tenant-kernel packages/platform-events
    expect: exit 1 zero matches
  - id: p4_infra_compose
    verify: infra/docker-compose.yml exists

guard_ids_binding_summary:
  - p4_red_flag_prerequisite
  - p4_tenant_kernel_build
  - p4_tenant_kernel_test
  - p4_platform_events_build
  - p4_platform_events_test
  - p4_contract_spec
  - p4_no_denali_in_kernel
  - p4_infra_compose

stale_doc_retired:
  numbered_table_14_2_depcruise:
    status: REMOVED — outdated
    note: "narrative §14.2 check 6 depcruise tenant-kernel — NOT in phase-4-guard.mjs; use guard:architecture via phase-3:gate"
  numbered_table_1_7_without_p4_ids:
    status: REMOVED — outdated
    replacement: p4_* ids above

guard_FAIL_condition: "any required check ok:false → process.exit(1)"
```

---

## CI PIPELINE — phase-4:gate (package.json REPO TRUTH)

```yaml
phase_4_gate:
  name: pnpm run phase-4:gate
  source: package.json scripts.phase-4:gate
  steps_ordered:
    - step: 1
      run: pnpm build
    - step: 2
      run: pnpm test
    - step: 3
      run: pnpm run phase-3:gate
      note: "includes phase-2:gate, doc-gate, phase-3:guard — full regression baseline"
      enforcementId: P4-E-REG-03
    - step: 4
      run: pnpm run phase-4:guard
      writes: reports/phase-4-gate-YYYY-MM-DD.json

phase_4_gate_NOT_in_outer_chain:
  - guard:architecture
  - guard:import-boundary
  note: "Covered inside phase-3:gate nested in step 3 — do not duplicate"

pre_commit_ci_integrity:
  script: scripts/ci-integrity-check.sh
  runs: [phase-0:gate, phase-1-guard delta via guard:symlink + phase-1-guard.mjs]
  does_NOT_run: [phase-3:gate, phase-4:gate]
  note: "REPO truth — Phase 4 merge gate = explicit pnpm run phase-4:gate in CI/PR"

local_commands:
  node: "nvm use && corepack enable — Node 24 per .nvmrc"
  install: pnpm install
  docker: docker compose -f infra/docker-compose.yml up -d
  doc_sync: pnpm run guard:doc-sync

workflow_requirement:
  rule: "PR Phase 4.6 MUST run pnpm run phase-4:gate before merge"
  rule: "PR MUST list P4-E-* IDs satisfied in verification_table"
  rule: "4.1+ FORBIDDEN until 4.0 red-flag report exists — p4_red_flag_prerequisite"
```
