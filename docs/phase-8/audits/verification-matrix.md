# Phase 8 — Verification matrix (REQ-P8 · RULE-P8)

```yaml
matrix_version: "2026-06-08-v1"
req_foundation_range: REQ-P8-001..REQ-P8-015
req_extended_range: REQ-P8-020..REQ-P8-053
command_atlas: this file § Subphase proof bundles
route_matrix: ../appendices/URBAN-ROUTE-MATRIX.md
product_scope: ../appendices/URBAN-PRODUCT-SCOPE.md
sole_router: ../phase-8-agent-router.md
```

## Honesty

Rows reference **TARGET** paths until implementation lands. Status `ABSENT` in [`IMPLEMENTATION-TRUTH.md`](IMPLEMENTATION-TRUTH.md) means the command may fail until the subphase closes — the command is still the verification authority.

---

## Foundation matrix — REQ-P8-001..REQ-P8-015

Tier 0 blockers + entry/auth prerequisites. **Shell commands are exact** — run from repository root after `nvm use && corepack enable`.

| REQ ID         | Subphase | Claim                                                               | Spec file                                                                       | Verification command                                                                                                                                 |
| -------------- | -------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **REQ-P8-001** | 8.0      | Phase 7 platform gate closed                                        | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                           | `pnpm run phase-7:gate`                                                                                                                              |
| **REQ-P8-002** | 8.0      | Entry ledger scaffold on disk (honest PENDING until phase-7 closes) | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                           | `test -f reports/phase-8-entry-verified.yaml && rg 'phase_7_gate' reports/phase-8-entry-verified.yaml && rg 'status:\s\*(PENDING                     | PASS)' reports/phase-8-entry-verified.yaml` · **`p8_entry_ledger_present`** guard · PASS behavioral requires `status: PASS`+`exit_code: 0` |
| **REQ-P8-003** | 8.0      | No urban core import creep                                          | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                           | `pnpm run guard:import-boundary`                                                                                                                     |
| **REQ-P8-004** | 8.1      | Urban route matrix authoritative                                    | [`appendices/URBAN-ROUTE-MATRIX.md`](../appendices/URBAN-ROUTE-MATRIX.md)       | `test -f docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md && rg -q 'INV-P8-007' docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md`                          |
| **REQ-P8-005** | 8.2      | Urban product scope delta documented                                | [`appendices/URBAN-PRODUCT-SCOPE.md`](../appendices/URBAN-PRODUCT-SCOPE.md)     | `test -f docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md && rg -q 'idx_tours_tenant_publish_catalog' docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md`  |
| **REQ-P8-006** | 8.0      | Verification matrix self-consistent                                 | this file                                                                       | `test -f docs/phase-8/audits/verification-matrix.md && test "$(rg -c '^\| \*\*REQ-P8-' docs/phase-8/audits/verification-matrix.md)" -ge 15`          |
| **REQ-P8-007** | 8.0      | No runtime `legacy/` import in trunk apps                           | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                           | `rg "from ['\"]legacy/" apps/api apps/web && exit 1                                                                                                  |                                                                                                                                            | exit 0`                                                                                                |
| **REQ-P8-008** | 8.0      | MAP §22 reviewed at entry                                           | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md)                           | `rg 'map_22_reviewed:\s*true' reports/phase-8-entry-verified.yaml`                                                                                   |
| **REQ-P8-009** | 8.0      | Genericity baseline recorded for 8.2                                | [`subphases/8.0-entry.md`](../subphases/8.0-entry.md) CP-8.0-06                 | `test -f reports/phase-8-genericity-baseline.yaml                                                                                                    |                                                                                                                                            | test -f reports/phase-7-genericity-baseline.yaml`                                                      |
| **REQ-P8-010** | 8.1      | SDK `TenantAuthz` owner contract                                    | [`appendices/CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) | `pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts`                                               |
| **REQ-P8-011** | 8.1      | Web owner access guard                                              | [`subphases/8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md)   | `pnpm --filter @apps/web exec node --import tsx --test test/urban-owner-access.spec.ts`                                                              |
| **REQ-P8-012** | 8.1      | API `assertWorkspaceOwner` + HTTP 403                               | [`appendices/CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) | `pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts` **and** `test/urban-settings-patch.spec.ts`                 |
| **REQ-P8-013** | 8.2      | Urban package registry matches scope delta                          | [`appendices/URBAN-PRODUCT-SCOPE.md`](../appendices/URBAN-PRODUCT-SCOPE.md)     | `pnpm --filter @app-tour/workspace-urban build && pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/urban-registry.spec.ts` |
| **REQ-P8-014** | 8.2      | Urban package full test suite                                       | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)         | `pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/**/*.spec.ts`                                                            |
| **REQ-P8-015** | 8.2      | platform-core zero diff at product port                             | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md)         | `git diff "$(yq -r .baseline_sha reports/phase-8-genericity-baseline.yaml 2>/dev/null                                                                |                                                                                                                                            | yq -r .baseline_sha reports/phase-7-genericity-baseline.yaml)" -- packages/platform-core \| test ! -s` |

---

## Extended matrix — REQ-P8-020..REQ-P8-053

Product port, silo, E2E, and closure gates (subphase decade blocks).

| REQ ID         | Subphase | Claim                               | Spec file                                                               | Verification command                                                                                                                     |
| -------------- | -------- | ----------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --- | ------- |
| **REQ-P8-020** | 8.2      | API catalog + registration HTTP     | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md) | `pnpm --filter @apps/api exec node --import tsx --test test/urban-catalog-registration.spec.ts`                                          |
| **REQ-P8-021** | 8.2      | Urban workspace plugin bound in API | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md) | `pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts`                                              |
| **REQ-P8-022** | 8.2      | No Denali rail for urban            | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md) | `rg 'urban.\*denali                                                                                                                      | denali.\*urban' packages/workspace-sdk/src/plugin/workspace-type-binding.ts && exit 1 |     | exit 0` |
| **REQ-P8-023** | 8.2      | Import boundary after port          | [`subphases/8.2-urban-features.md`](../subphases/8.2-urban-features.md) | `pnpm run guard:import-boundary`                                                                                                         |
| **REQ-P8-030** | 8.3      | `tenant_routes` DDL applied         | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)           | `test -f infra/sql/003_tenant_routes.sql`                                                                                                |
| **REQ-P8-031** | 8.3      | TenantConnectionRouter unit tests   | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)           | `pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts`                              |
| **REQ-P8-032** | 8.3      | Urban silo fixture integration      | [`subphases/8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)           | `pnpm --filter @apps/api exec node --import tsx --test test/urban-silo-fixture.spec.ts`                                                  |
| **REQ-P8-040** | 8.4      | Playwright urban smoke SMK-P8       | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)   | `pnpm --filter @apps/web run test:e2e:urban`                                                                                             |
| **REQ-P8-041** | 8.4      | HTTP E2E chain (no browser)         | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)   | `pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts`                                                      |
| **REQ-P8-042** | 8.4      | Member denied settings in E2E       | [`subphases/8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)   | `pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-04'`                                                                       |
| **REQ-P8-050** | 8.5      | Phase 8 nested gate                 | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | `pnpm run phase-8:gate`                                                                                                                  |
| **REQ-P8-051** | 8.5      | Product parity contract spec        | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | `pnpm --filter @apps/api exec node --import tsx --test test/phase-8.contract.spec.ts`                                                    |
| **REQ-P8-052** | 8.5      | CI integrity at closure             | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | `pnpm run ci:integrity`                                                                                                                  |
| **REQ-P8-053** | 8.5      | Forensic score ≥ 8                  | [`subphases/8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | `test -f docs/audits/phase-8-zero-debt-forensic-audit.mdoc && rg -q 'verdict:\s*PASS' docs/audits/phase-8-zero-debt-forensic-audit.mdoc` |

---

## RULE-P8 enforcement matrix

| RULE ID         | Subphase | Rule                                                                          | Verification command                                                                                                                                                                                                                                                                                                                  |
| --------------- | -------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ----------------------------------------------------- |
| **RULE-P8-004** | 8.1      | Urban admin mutations require `isWorkspaceOwner` — not `isAdminOrOwner` alone | `pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts` **and** `rg 'isAdminOrOwner' apps/api/src/urban apps/web/src/urban && exit 1 \|\| true` — urban admin paths must not use admin-or-owner without owner check per [`URBAN-ROUTE-MATRIX.md`](../appendices/URBAN-ROUTE-MATRIX.md) |
| **RULE-P8-006** | 8.3      | Silo DB URLs only via `TenantConnectionRouter`                                | `rg 'SILO_DATABASE_URL\|process\.env\.DATABASE_URL' apps/api/src --glob '!**/tenant-connection*.ts' --glob '!**/*.spec.ts' \| rg -v 'tenant-kernel' && exit 1 \|\| pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts`                                                         |
| **RULE-P8-007** | 8.0      | No runtime import from `legacy/` in trunk apps                                | `rg "from ['\"]legacy/" apps/api apps/web && exit 1 \|\| exit 0`                                                                                                                                                                                                                                                                      |
| **RULE-P8-010** | 8.5      | `phase-8:gate` chains `phase-7:gate` — no doc-only closure                    | `node -e "const p=require('./package.json'); const s=p.scripts['phase-8:gate']                                                                                                                                                                                                                                                        |     | ''; if(!s.includes('phase-7:gate')) process.exit(1)"` |

---

## INV-P8 cross-reference (invariant → REQ)

| Invariant  | Primary REQ                  | Proof                                                                                                      |
| ---------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| INV-P8-001 | REQ-P8-015 · REQ-P8-051      | platform-core diff empty + contract spec                                                                   |
| INV-P8-002 | REQ-P8-003 · REQ-P8-023      | `guard:import-boundary`                                                                                    |
| INV-P8-003 | REQ-P8-022                   | no urban→denali binding                                                                                    |
| INV-P8-004 | REQ-P8-007 · RULE-P8-007     | `rg legacy import`                                                                                         |
| INV-P8-005 | REQ-P8-040                   | E2E canonical SoT — no RHF mirror (`rg 'useForm' apps/web/app/(public) apps/web/app/(app)/settings/urban`) |
| INV-P8-006 | REQ-P8-031 · REQ-P8-032      | router + silo fixture                                                                                      |
| INV-P8-007 | REQ-P8-010..012 · REQ-P8-042 | owner specs + SMK-P8-04                                                                                    |

---

## Forbidden IDs (P8-F-\*)

| ID           | Subphase | Detection command                                                                                                                                      |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **P8-F-001** | 8.0      | Phase 8 started without `pnpm run phase-7:gate` exit 0 — `reports/phase-8-entry-verified.yaml` `phase_7_gate.exit_code` must be `0`                    |
| **P8-F-002** | 8.1      | Member can PATCH urban settings — fails `urban-settings-patch.spec.ts`                                                                                 |
| **P8-F-003** | 8.1      | Procedural `role === "owner"` in handlers without ability layer — `rg 'role === .owner.' apps/api/src/urban` must route through `assertWorkspaceOwner` |
| **P8-F-005** | 8.5      | Doc-guard-only closure — `pnpm run phase-8:gate` without full build+test chain                                                                         |
| **P8-F-010** | 8.2      | Finance/MinIO in urban package — `rg -i 'minio                                                                                                         | finance' packages/workspaces/urban && exit 1 \|\| exit 0` |
| **P8-F-011** | 8.2      | Static urban import outside lazy loader — `pnpm run guard:import-boundary`                                                                             |
| **P8-F-020** | 8.3      | Silo default for all tenants — seed audit in `urban-silo-fixture.spec.ts`                                                                              |
| **P8-F-030** | 8.4      | All Playwright tests skipped — `pnpm --filter @apps/web run test:e2e:urban -- --list` must show ≥4 tests                                               |

---

## Subphase proof bundles (copy-paste)

### 8.0 Entry

```bash
pnpm run phase-7:gate
pnpm run guard:import-boundary
rg "from ['\"]legacy/" apps/api apps/web && exit 1 || exit 0
```

### 8.1 Single-Owner auth

```bash
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-redis-fallback.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-tours-bypass-gate.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/urban-owner-access.spec.ts
pnpm run guard:import-boundary
```

### 8.2 Urban product port

```bash
pnpm --filter @app-tour/workspace-urban build
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/urban-registry.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-catalog-registration.spec.ts
pnpm run guard:import-boundary
```

### 8.3 Silo tier

```bash
pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-silo-fixture.spec.ts
```

### 8.4 E2E

```bash
pnpm --filter @apps/web run test:e2e:urban
pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts
```

### 8.5 Product Parity DoD

```bash
pnpm run phase-8:gate
pnpm --filter @apps/api exec node --import tsx --test test/phase-8.contract.spec.ts
pnpm run ci:integrity
```

---

---

## Smoke scenario command index (SMK-P8)

Each smoke ID must appear with an **executable** verification command (Playwright or HTTP E2E). Guard `p8_smoke_map_present` enforces this table.

| SMK ID        | Subphase | Spec file                                                                             | Verification command                                                                                                                                                            |
| ------------- | -------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **SMK-P8-01** | 8.4      | [`appendices/SMOKE-SCENARIO-MAP.md`](../appendices/SMOKE-SCENARIO-MAP.md) § SMK-P8-01 | `pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-01'` · `pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts` (describe `SMK-P8-01`) |
| **SMK-P8-02** | 8.4      | [`appendices/SMOKE-SCENARIO-MAP.md`](../appendices/SMOKE-SCENARIO-MAP.md) § SMK-P8-02 | `pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-02'` · `pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts` (describe `SMK-P8-02`) |
| **SMK-P8-03** | 8.4      | [`appendices/SMOKE-SCENARIO-MAP.md`](../appendices/SMOKE-SCENARIO-MAP.md) § SMK-P8-03 | `pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-03'` · `pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts` (describe `SMK-P8-03`) |
| **SMK-P8-04** | 8.4      | [`appendices/SMOKE-SCENARIO-MAP.md`](../appendices/SMOKE-SCENARIO-MAP.md) § SMK-P8-04 | `pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-04'` · `pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts` (describe `SMK-P8-04`) |

---

## Guard mapping (when `phase-8-guard.mjs` lands)

| Guard check ID                    | REQ coverage                              |
| --------------------------------- | ----------------------------------------- |
| `p8_boot_manifest`                | structural                                |
| `p8_doc_hardening`                | REQ-P8-004 · REQ-P8-005 · REQ-P8-006      |
| `p8_truth_honesty`                | IMPLEMENTATION-TRUTH ↔ this matrix        |
| `p8_erip_cop_present`             | router §5 ERIP (8.1–8.3)                  |
| `p8_technical_quality`            | TQ-P8-001..010 + REQ-P8-005 indexes       |
| `p8_platform_core_zero_diff`      | REQ-P8-015 · REQ-P8-051                   |
| `p8_no_legacy_runtime_import`     | REQ-P8-007                                |
| `p8_urban_not_denali_rail`        | REQ-P8-022                                |
| `p8_owner_auth_specs`             | REQ-P8-010..012 · TRACEABILITY-MATRIX-8.1 |
| `p8_urban_routes_bound`           | REQ-P8-004 · urban-api-dispatch-addendum  |
| `p8_smoke_map_present`            | REQ-P8-040..042 · SMK-P8-01..04           |
| `p8_verification_matrix_hydrated` | REQ-P8-010..012 file anchors              |
| `p8_boundary_ci_hook`             | PHASE-BOUNDARY-MATRIX · 8.1 PR train      |
