# Phase 4 — Guards (`p4_*`)

> **CI pipeline & PR gates:** [`ci.md`](ci.md)  
> **P4-E-\* claims:** [`phase-4-enforcement.md`](phase-4-enforcement.md) · [`audits/verification-matrix.md`](audits/verification-matrix.md)

```yaml
phase_4_guard_entrypoint:
  package_json: "node scripts/guards/phase-4-guard.mjs"
  alias: pnpm run phase-4:guard
  env: "PHASE_4_GATE_REPORT=YYYY-MM-DD optional slug"
  report: reports/phase-4-gate-YYYY-MM-DD.json

thresholds_file: scripts/guards/gate-thresholds.mjs
TENANT_KERNEL_TEST_MIN_phase4: 6
PLATFORM_EVENTS_TEST_MIN_phase4: 2

phase_4_integration_env:
  DATABASE_URL: "required for p4_rls_integration_tests (RLS spec only)"
  DATABASE_URL_ADMIN: "recommended for RLS spec cleanup/migrate"
  STORAGE_DRIVER: "prisma for RLS spawn; memory for tenant-security spawn (guard sets per spec)"
```

## Guard checks (execution order)

| id                         | enforcementId               | Command / verify                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `p4_red_flag_prerequisite` | P4-E-RF-40                  | `reports/phase-3.2-red-flag-status-*.md` exists                                                                                                                                                                                                                                                                                                     |
| `p4_tenant_kernel_build`   | —                           | `pnpm --filter @app-tour/tenant-kernel run build`                                                                                                                                                                                                                                                                                                   |
| `p4_tenant_kernel_test`    | P4-E-HOST-01                | tenant-kernel `test` (min 6)                                                                                                                                                                                                                                                                                                                        |
| `p4_platform_events_build` | —                           | platform-events `build`                                                                                                                                                                                                                                                                                                                             |
| `p4_platform_events_test`  | P4-E-EVT-01                 | platform-events `test` (min 2)                                                                                                                                                                                                                                                                                                                      |
| `p4_contract_spec`         | P4-E-HOST-01, P4-E-RLS-02   | `test:phase-4`                                                                                                                                                                                                                                                                                                                                      |
| `p4_no_denali_in_kernel`   | forbidden                   | `rg -i denali` → zero matches                                                                                                                                                                                                                                                                                                                       |
| `p4_infra_compose`         | DOD-4                       | `infra/docker-compose.yml` exists                                                                                                                                                                                                                                                                                                                   |
| `p4_rls_integration_tests` | P4-E-RLS-01, P4-E-TENANT-01 | **Sequential** runs: (1) `rls-isolation.integration.spec.ts` with `DATABASE_URL` + `STORAGE_DRIVER=prisma`; (2) `tenant-security.spec.ts` with `STORAGE_DRIVER=memory` and **no** `DATABASE_URL` (avoids Prisma pool keeping process alive). Flags: `--test-concurrency=1`, `--test-timeout=120000`, `--test-force-exit`. Progress logged per step. |
| `p4_anti_hollow_tests`     | P4-E-RLS-01 (static)        | mechanism tests contain real `assert.*` — no placeholder-only bodies                                                                                                                                                                                                                                                                                |

```yaml
guard_FAIL_condition: "any required check ok:false → process.exit(1)"
anti_hollow_script: scripts/guards/lib/anti-hollow-phase4.mjs
rls_integration_script: scripts/guards/phase-4-guard.mjs → evaluateRlsIntegrationTests()
```

## Retired (do not use)

| Obsolete                             | Replacement                                       |
| ------------------------------------ | ------------------------------------------------- |
| Narrative §14.2 numbered table 1–7   | `p4_*` table above                                |
| depcruise inside `phase-4:guard`     | `guard:architecture` via nested `phase-3:gate`    |
| `phase-4:guard` alone as merge proof | full `pnpm run phase-4:gate` per [`ci.md`](ci.md) |
| Anti-hollow only as RLS proof        | `p4_rls_integration_tests` runs DB-backed specs   |
