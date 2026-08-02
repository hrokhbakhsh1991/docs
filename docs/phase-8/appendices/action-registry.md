# Phase 8 — Action registry

```yaml
registry_version: "2026-06-07-v1"
authority: phase-8-charter.md · subphases/8.0-entry.md … 8.5-platform-dod.md
index: PRECISION-DOC-INDEX.md
action_count: 29
cross_cutting: none
note: "P8-X-A* not defined in Phase 8 PEK — defer to Block C if needed"
```

> Canonical ledger for every `P8-*-A*` action ID declared in Phase 8 subphase front-matter. **Responsible actor** is the merge gate owner. **Verification evidence** is the forensic artifact an auditor must find in CI logs or repo paths — not narrative claims.

---

## Index

| action_id | subphase | spec file                                                                     |
| --------- | -------- | ----------------------------------------------------------------------------- |
| P8-0-A01  | 8.0      | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         |
| P8-0-A02  | 8.0      | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         |
| P8-0-A03  | 8.0      | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         |
| P8-0-A04  | 8.0      | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                         |
| P8-1-A01  | 8.1      | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) |
| P8-1-A02  | 8.1      | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) |
| P8-1-A03  | 8.1      | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) |
| P8-1-A04  | 8.1      | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) |
| P8-1-A05  | 8.1      | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) |
| P8-1-A06  | 8.1      | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md) |
| P8-2-A01  | 8.2      | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       |
| P8-2-A02  | 8.2      | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       |
| P8-2-A03  | 8.2      | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       |
| P8-2-A04  | 8.2      | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       |
| P8-2-A05  | 8.2      | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       |
| P8-2-A06  | 8.2      | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)       |
| P8-3-A01  | 8.3      | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 |
| P8-3-A02  | 8.3      | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 |
| P8-3-A03  | 8.3      | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 |
| P8-3-A04  | 8.3      | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)                 |
| P8-4-A01  | 8.4      | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         |
| P8-4-A02  | 8.4      | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         |
| P8-4-A03  | 8.4      | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         |
| P8-4-A04  | 8.4      | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)         |
| P8-5-A01  | 8.5      | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           |
| P8-5-A02  | 8.5      | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           |
| P8-5-A03  | 8.5      | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           |
| P8-5-A04  | 8.5      | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           |
| P8-5-A05  | 8.5      | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)           |

---

## Subphase 8.0 — Entry gate

### P8-0-A01 — Run phase-7:gate and capture exit evidence

| Field                            | Value                                                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | DevOps CI                                                                                                      |
| **Operational subphase trigger** | 8.0 (entry — blocks 8.1)                                                                                       |
| **Verification evidence target** | CI log line `pnpm run phase-7:gate` **exit 0** · nested report `reports/phase-7-gate-*.json` with `"ok": true` |

### P8-0-A02 — Write phase-8 entry verified yaml

| Field                            | Value                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Architect / Release Engineer                                                                                                       |
| **Operational subphase trigger** | 8.0                                                                                                                                |
| **Verification evidence target** | `reports/phase-8-entry-verified.yaml` — fields `phase_7_gate.status: PASS` · `map_22_reviewed: true` · `verified_at` ISO timestamp |

### P8-0-A03 — Verify no urban creep in API generic layer

| Field                            | Value                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Platform Automation                                                                                                         |
| **Operational subphase trigger** | 8.0                                                                                                                         |
| **Verification evidence target** | `pnpm run guard:import-boundary` exit 0 · `rg 'URBAN_' apps/api/src --glob '!**/workspace/**'` → **zero matches** in CI log |

### P8-0-A04 — Assert zero legacy runtime imports in trunk apps

| Field                            | Value                                                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Platform Automation                                                                                                                               |
| **Operational subphase trigger** | 8.0                                                                                                                                               |
| **Verification evidence target** | `rg "from ['\"]legacy/" apps/api apps/web` → **zero matches** · future guard token `p8_no_legacy_runtime_import` in `reports/phase-8-gate-*.json` |

---

## Subphase 8.1 — Single-owner auth

### P8-1-A01 — SDK owner mutation ability

| Field                            | Value                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Workspace SDK Implementer                                                                                       |
| **Operational subphase trigger** | 8.1                                                                                                             |
| **Verification evidence target** | `packages/workspaces/urban/test/urban-owner-ability.spec.ts` exit 0 · TAP output includes SDK-8.1-01..08 pass rows |

### P8-1-A02 — API assertWorkspaceOwner + error mapping

| Field                            | Value                                                                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | API Platform Engineer                                                                                                                                     |
| **Operational subphase trigger** | 8.1                                                                                                                                                       |
| **Verification evidence target** | `apps/api/test/urban-owner-ability.spec.ts` exit 0 · `apps/api/src/urban/urban-owner-required.error.ts` · response log sample `code=URBAN_OWNER_REQUIRED` |

### P8-1-A03 — Urban settings HTTP routes (owner pipeline)

| Field                            | Value                                                                                                                                          |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | API Platform Engineer                                                                                                                          |
| **Operational subphase trigger** | 8.1                                                                                                                                            |
| **Verification evidence target** | `apps/api/test/urban-settings-patch.spec.ts` exit 0 · API-8.1-04 JSON body `{"code":"URBAN_OWNER_REQUIRED"}` on member `PATCH /urban/settings` |

### P8-1-A04 — Web canLoadUrbanSettings guard

| Field                            | Value                                                                                                     |
| -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Web Workspace Engineer                                                                                    |
| **Operational subphase trigger** | 8.1                                                                                                       |
| **Verification evidence target** | `apps/web/test/urban-owner-access.spec.ts` exit 0 · `apps/web/src/urban/urban-settings-access.ts` on disk |

### P8-1-A05 — Lock CASL spec + route matrix alignment

| Field                            | Value                                                                                                                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Architect                                                                                                                                                                                 |
| **Operational subphase trigger** | 8.1 (pre-merge doc gate)                                                                                                                                                                  |
| **Verification evidence target** | PR checklist CP-8.1-05/06 · `docs/phase-8/appendices/CASL-URBAN-OWNER-SPEC.md` `status: LOCKED` · `docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md` owner rows cite `isWorkspaceOwner` only |

### P8-1-A06 — Platform-core zero diff + import boundary

| Field                            | Value                                                                                                                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Platform Automation                                                                                                                                                                                                                                  |
| **Operational subphase trigger** | 8.1 (every PR)                                                                                                                                                                                                                                       |
| **Verification evidence target** | `git diff $(yq -r .baseline_sha reports/phase-7-genericity-baseline.yaml) -- packages/platform-core` empty · `pnpm run guard:import-boundary` exit 0 · `pnpm run phase-8:guard` → `p8_platform_core_zero_diff` pass in `reports/phase-8-gate-*.json` |

---

## Subphase 8.2 — Urban product port

### P8-2-A01 — Extend urban.plugin registry + composites

| Field                            | Value                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Workspace Urban Plugin Owner                                                                                                                                            |
| **Operational subphase trigger** | 8.2                                                                                                                                                                     |
| **Verification evidence target** | `pnpm --filter @app-tour/workspace-urban test` exit 0 · `packages/workspaces/urban/src/urban.plugin.ts` composites `urban.publicCatalogCard` · `urban.registrationForm` |

### P8-2-A02 — Wire API urban HTTP routes

| Field                            | Value                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | API Platform Engineer                                                                                                                                    |
| **Operational subphase trigger** | 8.2                                                                                                                                                      |
| **Verification evidence target** | `apps/api/test/urban-catalog-registration.spec.ts` exit 0 · `apps/api/src/urban/urban.routes.ts` registered in `apps/api/src/openapi/dispatch-routes.ts` |

### P8-2-A03 — Web lazy loader + public catalog/register/settings routes

| Field                            | Value                                                                                                                                                                                                                                                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Web Workspace Engineer                                                                                                                                                                                                                                     |
| **Operational subphase trigger** | 8.2                                                                                                                                                                                                                                                        |
| **Verification evidence target** | `apps/web/src/bootstrap/lazy-urban-plugin.ts` · `apps/web/app/(public)/catalog/**` · `apps/web/app/(app)/settings/urban/page.tsx` · `pnpm run guard:import-boundary` exit 0 · `rg '@app-tour/workspace-denali' apps/web/app/(public)/catalog` → no matches |

### P8-2-A04 — Workspace-sdk urban type binding

| Field                            | Value                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Workspace SDK Implementer                                                                                                                                            |
| **Operational subphase trigger** | 8.2                                                                                                                                                                  |
| **Verification evidence target** | Integration spec asserting `resolveWorkspacePluginForType("urban")` returns urban plugin · `packages/workspace-sdk/src/plugin/workspace-type-binding.ts` binding row |

### P8-2-A05 — Record post-port genericity baseline

| Field                            | Value                                                                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Architect / Release Engineer                                                                                                  |
| **Operational subphase trigger** | 8.2 (closure of product port)                                                                                                 |
| **Verification evidence target** | `reports/phase-8-genericity-baseline.yaml` with `baseline_sha` · empty `git diff` on `packages/platform-core` at recorded SHA |

### P8-2-A06 — Regression — 8.1 owner tests still green

| Field                            | Value                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Platform Automation                                                                                                        |
| **Operational subphase trigger** | 8.2 (pre-merge)                                                                                                            |
| **Verification evidence target** | `apps/web/test/urban-owner-access.spec.ts` exit 0 · `apps/api/test/urban-settings-patch.spec.ts` exit 0 in same CI job log |

---

## Subphase 8.3 — Silo tier integration

### P8-3-A01 — Apply tenant_routes DDL

| Field                            | Value                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | DevOps CI / DBA Automation                                                                                                         |
| **Operational subphase trigger** | 8.3                                                                                                                                |
| **Verification evidence target** | `infra/sql/003_tenant_routes.sql` applied · Postgres `\d tenant_routes` shows `tier` CHECK · migrate log `Applied migration` in CI |

### P8-3-A02 — Implement TenantConnectionRouter

| Field                            | Value                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Tenant Kernel Engineer                                                                                                                  |
| **Operational subphase trigger** | 8.3                                                                                                                                     |
| **Verification evidence target** | `packages/tenant-kernel/test/tenant-connection-router.spec.ts` exit 0 · `packages/tenant-kernel/src/router/tenant-connection-router.ts` |

### P8-3-A03 — Wire API connection factory to router

| Field                            | Value                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | API Platform Engineer                                                                                                     |
| **Operational subphase trigger** | 8.3                                                                                                                       |
| **Verification evidence target** | `apps/api/test/urban-silo-fixture.spec.ts` exit 0 · `apps/api/src/**/tenant-connection*.ts` factory import of router only |

### P8-3-A04 — Document enterprise urban silo fixture tenant

| Field                            | Value                                                                                                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Architect / Tenant Kernel Engineer                                                                                                                                                              |
| **Operational subphase trigger** | 8.3                                                                                                                                                                                             |
| **Verification evidence target** | Stable silo tenant UUID in `apps/api/test/urban-silo-fixture.spec.ts` or `apps/api/test/fixtures/urban-silo-enterprise-tenant.ts` · `tenant_routes` seed row `tier: silo` in test bootstrap log |

---

## Subphase 8.4 — E2E integrity

### P8-4-A01 — Playwright urban config + npm script

| Field                            | Value                                                                                                                                                                                    |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | E2E Test Engineer                                                                                                                                                                        |
| **Operational subphase trigger** | 8.4                                                                                                                                                                                      |
| **Verification evidence target** | `apps/web/playwright.urban.config.ts` · `apps/web/package.json` scripts `test:e2e:urban` and `test:e2e:urban:install` · `jq '.scripts["test:e2e:urban"]' apps/web/package.json` non-null |

### P8-4-A02 — Implement SMK-P8-01..04 Playwright specs

| Field                            | Value                                                                                                                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | E2E Test Engineer                                                                                                                                                                             |
| **Operational subphase trigger** | 8.4                                                                                                                                                                                           |
| **Verification evidence target** | `pnpm --filter @apps/web run test:e2e:urban` exit 0 · Playwright report `apps/web/test-results/` · tests named `SMK-P8-01` … `SMK-P8-04` per [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md) |

### P8-4-A03 — HTTP urban e2e integration spec (API)

| Field                            | Value                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Responsible actor**            | API Platform Engineer                                                                           |
| **Operational subphase trigger** | 8.4                                                                                             |
| **Verification evidence target** | `apps/api/test/urban-e2e-http.spec.ts` exit 0 · describe blocks `SMK-P8-01`..`04` in TAP output |

### P8-4-A04 — Owner + member session fixtures for settings

| Field                            | Value                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | E2E Test Engineer                                                                                                                                                                                  |
| **Operational subphase trigger** | 8.4                                                                                                                                                                                                |
| **Verification evidence target** | `apps/web/tests/e2e/fixtures/urban-owner-session.ts` · `urban-member-session.ts` · CP-8.4-03 settings **200** screenshot/trace · CP-8.4-04 `[data-workspace-wizard-forbidden]` in Playwright trace |

---

## Subphase 8.5 — Product Parity DoD gate

### P8-5-A01 — Wire phase-8:guard + phase-8:gate scripts

| Field                            | Value                                                                                                                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Platform Automation                                                                                                                                                                     |
| **Operational subphase trigger** | 8.5                                                                                                                                                                                     |
| **Verification evidence target** | Root `package.json` scripts `phase-8:guard` · `phase-8:gate` · `node scripts/guards/phase-8-guard.mjs` exit 0 · `reports/phase-8-gate-*.json` `checks[].id` includes `p8_boot_manifest` |

### P8-5-A02 — Implement phase-8.contract.spec.ts

| Field                            | Value                                                                                                                                                |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | API Platform Engineer                                                                                                                                |
| **Operational subphase trigger** | 8.5                                                                                                                                                  |
| **Verification evidence target** | `apps/api/test/phase-8.contract.spec.ts` exit 0 · contract cases: `platform-core` zero diff assertion · member-denied settings mutation (INV-P8-007) |

### P8-5-A03 — Run full phase-8:gate and write closure JSON

| Field                            | Value                                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | DevOps CI                                                                                                                           |
| **Operational subphase trigger** | 8.5 (closure)                                                                                                                       |
| **Verification evidence target** | `pnpm run phase-8:gate` exit 0 · `reports/phase-8-gate-YYYY-MM-DD.json` field `"ok": true` · nested `phase-7:guard` pass in same job |

### P8-5-A04 — Complete forensic audit mdoc

| Field                            | Value                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Architect                                                                                                                                                               |
| **Operational subphase trigger** | 8.5 (human gate)                                                                                                                                                        |
| **Verification evidence target** | `docs/audits/phase-8-zero-debt-forensic-audit.mdoc` · verdict `PASS` · weighted score ≥ **8.0** per [`FORENSIC-RUBRIC.md`](../../phase-7/appendices/FORENSIC-RUBRIC.md) |

### P8-5-A05 — Final IMPLEMENTATION-TRUTH closure

| Field                            | Value                                                                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Responsible actor**            | Architect / Release Engineer                                                                                                                             |
| **Operational subphase trigger** | 8.5 (final)                                                                                                                                              |
| **Verification evidence target** | `docs/phase-8/audits/IMPLEMENTATION-TRUTH.md` — subphases 8.1–8.4 `VERIFIED_BEHAVIORAL` · `phase_8_closed: true` · `closure_git_sha` set to merge commit |

---

## Verification

```bash
# Count actions match registry
rg -o 'P8-[0-9]-A[0-9]+' docs/phase-8/subphases docs/phase-8/phase-8-charter.md | sort -u | wc -l
# expect: 29

# Cross-check index
rg 'P8-4-A02' docs/phase-8/appendices/action-registry.md
```

**REQ:** REQ-P8-003 (action registry present) · future `p8_action_registry` guard check (Block C).
