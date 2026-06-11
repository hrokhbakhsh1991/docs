# Phase 8 — Verification matrix (REQ-P8 · RULE-P8)

```yaml
matrix_version: "2026-06-08-v2"
req_foundation_range: REQ-P8-001..REQ-P8-015
req_extended_range: REQ-P8-020..REQ-P8-053
command_atlas: ../appendices/verification-commands.md
route_matrix: ../appendices/URBAN-ROUTE-MATRIX.md
product_scope: ../appendices/URBAN-PRODUCT-SCOPE.md
sole_router: ../phase-8-agent-router.md
navigator: ../AGENT-NAVIGATOR.md
```

## Honesty

Rows reference **TARGET** paths until implementation lands. Status `ABSENT` in [`IMPLEMENTATION-TRUTH.md`](IMPLEMENTATION-TRUTH.md) means the command may fail until the subphase closes — the command is still the verification authority.

**Copy-paste commands:** use [`verification-commands.md`](../appendices/verification-commands.md) or § CMD blocks below — **not** raw table cells (pipes break markdown).

---

## Foundation matrix — REQ-P8-001..REQ-P8-015

| REQ ID         | Subphase | Claim                                | Spec file                                                            | Command ref                                                                 |
| -------------- | -------- | ------------------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **REQ-P8-001** | 8.0      | Phase 7 platform gate closed         | [`8.0-entry.md`](../subphases/8.0-entry.md)                          | CMD-P8-001                                                                  |
| **REQ-P8-002** | 8.0      | Entry ledger on disk                 | [`8.0-entry.md`](../subphases/8.0-entry.md)                          | CMD-P8-002                                                                  |
| **REQ-P8-003** | 8.0      | No urban core import creep           | [`8.0-entry.md`](../subphases/8.0-entry.md)                          | CMD-P8-003                                                                  |
| **REQ-P8-004** | 8.1      | Urban route matrix authoritative     | [`URBAN-ROUTE-MATRIX.md`](../appendices/URBAN-ROUTE-MATRIX.md)       | CMD-P8-004                                                                  |
| **REQ-P8-005** | 8.2      | Urban product scope documented       | [`URBAN-PRODUCT-SCOPE.md`](../appendices/URBAN-PRODUCT-SCOPE.md)     | CMD-P8-005                                                                  |
| **REQ-P8-006** | 8.0      | Verification matrix self-consistent  | this file                                                            | CMD-P8-006                                                                  |
| **REQ-P8-007** | 8.0      | No runtime `legacy/` import          | [`8.0-entry.md`](../subphases/8.0-entry.md)                          | CMD-P8-007                                                                  |
| **REQ-P8-008** | 8.0      | MAP §22 reviewed at entry            | [`8.0-entry.md`](../subphases/8.0-entry.md)                          | CMD-P8-008                                                                  |
| **REQ-P8-009** | 8.0      | Genericity baseline recorded         | [`8.0-entry.md`](../subphases/8.0-entry.md) CP-8.0-06                | CMD-P8-009                                                                  |
| **REQ-P8-010** | 8.1      | SDK TenantAuthz owner contract       | [`CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) | CMD-P8-010 · `urban-owner-ability.spec.ts`                                  |
| **REQ-P8-011** | 8.1      | Web owner access guard               | [`8.1-single-owner-auth.md`](../subphases/8.1-single-owner-auth.md)  | CMD-P8-011 · `urban-owner-access.spec.ts`                                   |
| **REQ-P8-012** | 8.1      | API assertWorkspaceOwner + HTTP 403  | [`CASL-URBAN-OWNER-SPEC.md`](../appendices/CASL-URBAN-OWNER-SPEC.md) | CMD-P8-012 · `urban-owner-ability.spec.ts` · `urban-settings-patch.spec.ts` |
| **REQ-P8-013** | 8.2      | Urban package registry matches scope | [`URBAN-PRODUCT-SCOPE.md`](../appendices/URBAN-PRODUCT-SCOPE.md)     | CMD-P8-013                                                                  |
| **REQ-P8-014** | 8.2      | Urban package full test suite        | [`8.2-urban-features.md`](../subphases/8.2-urban-features.md)        | CMD-P8-014                                                                  |
| **REQ-P8-015** | 8.2      | platform-core zero diff              | [`8.2-urban-features.md`](../subphases/8.2-urban-features.md)        | CMD-P8-015                                                                  |

---

## Extended matrix — REQ-P8-020..REQ-P8-053

| REQ ID         | Subphase | Claim                               | Spec file                                                     | Command ref |
| -------------- | -------- | ----------------------------------- | ------------------------------------------------------------- | ----------- |
| **REQ-P8-020** | 8.2      | API catalog + registration HTTP     | [`8.2-urban-features.md`](../subphases/8.2-urban-features.md) | CMD-P8-020  |
| **REQ-P8-021** | 8.2      | Urban workspace plugin bound in API | [`8.2-urban-features.md`](../subphases/8.2-urban-features.md) | CMD-P8-021  |
| **REQ-P8-022** | 8.2      | No Denali rail for urban            | [`8.2-urban-features.md`](../subphases/8.2-urban-features.md) | CMD-P8-022  |
| **REQ-P8-023** | 8.2      | Import boundary after port          | [`8.2-urban-features.md`](../subphases/8.2-urban-features.md) | CMD-P8-003  |
| **REQ-P8-030** | 8.3      | tenant_routes DDL applied           | [`8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)           | CMD-P8-030  |
| **REQ-P8-031** | 8.3      | TenantConnectionRouter unit tests   | [`8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)           | CMD-P8-031  |
| **REQ-P8-032** | 8.3      | Urban silo fixture integration      | [`8.3-silo-tier.md`](../subphases/8.3-silo-tier.md)           | CMD-P8-032  |
| **REQ-P8-040** | 8.4      | Playwright urban smoke SMK-P8       | [`8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)   | CMD-P8-040  |
| **REQ-P8-041** | 8.4      | HTTP E2E chain (no browser)         | [`8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)   | CMD-P8-041  |
| **REQ-P8-042** | 8.4      | Member denied settings in E2E       | [`8.4-e2e-integrity.md`](../subphases/8.4-e2e-integrity.md)   | CMD-P8-042  |
| **REQ-P8-050** | 8.5      | Phase 8 nested gate                 | [`8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | CMD-P8-050  |
| **REQ-P8-051** | 8.5      | Product parity contract spec        | [`8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | CMD-P8-051  |
| **REQ-P8-052** | 8.5      | CI integrity at closure             | [`8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | CMD-P8-052  |
| **REQ-P8-053** | 8.5      | Forensic score ≥ 8                  | [`8.5-platform-dod.md`](../subphases/8.5-platform-dod.md)     | CMD-P8-053  |

---

## RULE-P8 enforcement matrix

| RULE ID         | Subphase | Rule                                           | Command ref                  |
| --------------- | -------- | ---------------------------------------------- | ---------------------------- |
| **RULE-P8-004** | 8.1      | Urban admin mutations require isWorkspaceOwner | CMD-P8-010 · CMD-RULE-P8-004 |
| **RULE-P8-006** | 8.3      | Silo DB URLs only via TenantConnectionRouter   | CMD-P8-031                   |
| **RULE-P8-007** | 8.0      | No runtime import from legacy/ in trunk apps   | CMD-P8-007                   |
| **RULE-P8-010** | 8.5      | phase-8:gate chains phase-7:gate               | CMD-RULE-P8-010              |

---

## INV-P8 cross-reference

| Invariant  | Primary REQ                  | Command ref                  |
| ---------- | ---------------------------- | ---------------------------- |
| INV-P8-001 | REQ-P8-015 · REQ-P8-051      | CMD-P8-015 · CMD-P8-051      |
| INV-P8-002 | REQ-P8-003 · REQ-P8-023      | CMD-P8-003                   |
| INV-P8-003 | REQ-P8-022                   | CMD-P8-022                   |
| INV-P8-004 | REQ-P8-007 · RULE-P8-007     | CMD-P8-007                   |
| INV-P8-005 | REQ-P8-040                   | CMD-P8-040                   |
| INV-P8-006 | REQ-P8-031 · REQ-P8-032      | CMD-P8-031 · CMD-P8-032      |
| INV-P8-007 | REQ-P8-010..012 · REQ-P8-042 | CMD-P8-010..012 · CMD-P8-042 |

---

## Forbidden IDs (P8-F-\*)

| ID           | Subphase | Detection                                                 |
| ------------ | -------- | --------------------------------------------------------- |
| **P8-F-001** | 8.0      | phase_7_gate.exit_code must be 0 in entry yaml            |
| **P8-F-002** | 8.1      | CMD-P8-012 urban-settings-patch fails for member          |
| **P8-F-003** | 8.1      | Handlers must use assertWorkspaceOwner not raw role check |
| **P8-F-005** | 8.5      | CMD-P8-050 without build+test chain                       |
| **P8-F-010** | 8.2      | CMD-P8-F-010 finance/minio grep in urban package          |
| **P8-F-011** | 8.2      | CMD-P8-003 import boundary                                |
| **P8-F-020** | 8.3      | Silo not default for all tenants                          |
| **P8-F-030** | 8.4      | Playwright list must show ≥4 urban tests                  |

---

## Command blocks (copy-paste safe)

### CMD-P8-001 — Phase 7 gate

```bash
pnpm run phase-7:gate
```

### CMD-P8-002 — Entry ledger

```bash
test -f reports/phase-8-entry-verified.yaml
rg 'phase_7_gate' reports/phase-8-entry-verified.yaml
rg 'status:\s*PASS' reports/phase-8-entry-verified.yaml
rg 'exit_code:\s*0' reports/phase-8-entry-verified.yaml
```

### CMD-P8-003 — Import boundary

```bash
pnpm run guard:import-boundary
```

### CMD-P8-004 — Route matrix present

```bash
test -f docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md
rg -q 'INV-P8-007' docs/phase-8/appendices/URBAN-ROUTE-MATRIX.md
```

### CMD-P8-005 — Product scope present

```bash
test -f docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md
rg -q 'idx_tours_tenant_publish_catalog' docs/phase-8/appendices/URBAN-PRODUCT-SCOPE.md
```

### CMD-P8-006 — Matrix self-check

```bash
test -f docs/phase-8/audits/verification-matrix.md
test "$(rg -c '^\| \*\*REQ-P8-' docs/phase-8/audits/verification-matrix.md)" -ge 15
```

### CMD-P8-007 — No legacy runtime import

```bash
if rg "from ['\"]legacy/" apps/api apps/web; then exit 1; else exit 0; fi
```

### CMD-P8-008 — MAP §22 reviewed

```bash
rg 'map_22_reviewed:\s*true' reports/phase-8-entry-verified.yaml
```

### CMD-P8-009 — Genericity baseline

```bash
test -f reports/phase-8-genericity-baseline.yaml || test -f reports/phase-7-genericity-baseline.yaml
```

### CMD-P8-010 — SDK owner ability

```bash
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/urban-owner-ability.spec.ts
```

### CMD-P8-011 — Web owner access

```bash
pnpm --filter @apps/web exec node --import tsx --test test/urban-owner-access.spec.ts
```

### CMD-P8-012 — API owner + settings patch

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-owner-ability.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts
```

### CMD-P8-013 — Urban registry test

```bash
pnpm --filter @app-tour/workspace-urban build
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/urban-registry.spec.ts
```

### CMD-P8-014 — Urban package full suite

```bash
pnpm --filter @app-tour/workspace-urban exec node --import tsx --test test/**/*.spec.ts
```

### CMD-P8-015 — platform-core zero diff

```bash
BASELINE_SHA="$(grep baseline_sha reports/phase-8-genericity-baseline.yaml 2>/dev/null | awk '{print $2}' || grep baseline_sha reports/phase-7-genericity-baseline.yaml | awk '{print $2}')"
git diff "${BASELINE_SHA}" -- packages/platform-core | test ! -s
```

### CMD-P8-020 — Catalog registration HTTP

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-catalog-registration.spec.ts
```

### CMD-P8-021 — Urban plugin bound

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-workspace-plugin.spec.ts
```

### CMD-P8-022 — No urban-denali rail

```bash
if rg 'urban.*denali|denali.*urban' packages/workspace-sdk/src/plugin/workspace-type-binding.ts; then exit 1; else exit 0; fi
```

### CMD-P8-030 — tenant_routes reference + Prisma head

```bash
test -f infra/sql/005_tenant_routes.sql
rg -q '20260607100000_tenant_routes' apps/api/prisma/migrations -g 'migration.sql' || rg -q 'tenant_routes' apps/api/prisma/schema.prisma
```

### CMD-P8-031 — TenantConnectionRouter tests

```bash
pnpm --filter @app-tour/tenant-kernel exec node --import tsx --test test/tenant-connection-router.spec.ts
```

### CMD-P8-032 — Urban silo fixture

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-silo-fixture.spec.ts
```

### CMD-P8-040 — Playwright urban smoke

```bash
pnpm --filter @apps/web run test:e2e:urban
```

### CMD-P8-041 — HTTP E2E chain

```bash
pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts
```

### CMD-P8-042 — Member denied settings E2E

```bash
pnpm --filter @apps/web run test:e2e:urban -- --grep 'SMK-P8-04'
```

### CMD-P8-050 — Phase 8 gate

```bash
pnpm run phase-8:gate
```

### CMD-P8-051 — Product parity contract

```bash
pnpm --filter @apps/api exec node --import tsx --test test/phase-8.contract.spec.ts
```

### CMD-P8-052 — CI integrity

```bash
pnpm run ci:integrity
```

### CMD-P8-053 — Forensic PASS

```bash
test -f docs/audits/phase-8-zero-debt-forensic-audit.mdoc
rg -q 'verdict:\s*PASS' docs/audits/phase-8-zero-debt-forensic-audit.mdoc
```

### CMD-RULE-P8-004 — No isAdminOrOwner on urban paths

```bash
if rg 'isAdminOrOwner' apps/api/src/urban apps/web/src/urban; then exit 1; else exit 0; fi
```

### CMD-RULE-P8-010 — phase-8:gate chains phase-7:gate

```bash
node -e "const s=require('./package.json').scripts['phase-8:gate']||''; if(!s.includes('phase-7:gate')) process.exit(1)"
```

### CMD-P8-F-010 — No finance/minio in urban package

```bash
if rg -i 'minio|finance' packages/workspaces/urban; then exit 1; else exit 0; fi
```

---

## Subphase proof bundles

See [`verification-commands.md`](../appendices/verification-commands.md) for grouped subphase commands (8.0–8.5).

### 8.1 Single-Owner auth

| Spec anchor          | Trunk path                                                |
| -------------------- | --------------------------------------------------------- |
| REQ-P8-010 SDK       | `packages/workspaces/urban/test/urban-owner-ability.spec.ts` |
| REQ-P8-011 Web       | `apps/web/test/urban-owner-access.spec.ts`                |
| REQ-P8-012 API owner | `apps/api/test/urban-owner-ability.spec.ts`               |
| REQ-P8-012 API patch | `apps/api/test/urban-settings-patch.spec.ts`              |
| 8.1 bundle redis     | `apps/api/test/urban-redis-fallback.spec.ts`              |
| TPG-8.1 bypass       | `apps/api/test/urban-tours-bypass-gate.spec.ts`           |

### 8.2 Urban product port

Product port proof deferred until subphase 8.2 behavioral PR — see CMD-P8-013..022.

---

## Smoke scenario command index (SMK-P8)

| SMK ID    | Subphase | Command                                                                             |
| --------- | -------- | ----------------------------------------------------------------------------------- |
| SMK-P8-01 | 8.4      | `pnpm --filter @apps/web run test:e2e:urban --grep SMK-P8-01`                       |
| SMK-P8-02 | 8.4      | `pnpm --filter @apps/web run test:e2e:urban --grep SMK-P8-02`                       |
| SMK-P8-03 | 8.4      | `pnpm --filter @apps/web run test:e2e:urban --grep SMK-P8-03`                       |
| SMK-P8-04 | 8.4      | `pnpm --filter @apps/api exec node --import tsx --test test/urban-e2e-http.spec.ts` |

---

## Guard mapping

| Guard check ID                    | REQ coverage                          |
| --------------------------------- | ------------------------------------- |
| `p8_boot_manifest`                | structural                            |
| `p8_doc_hardening`                | REQ-P8-004 · REQ-P8-005 · REQ-P8-006  |
| `p8_truth_honesty`                | IMPLEMENTATION-TRUTH ↔ this matrix    |
| `p8_agent_navigator_present`      | AGENT-NAVIGATOR · AGENT-CURRENT-PHASE |
| `p8_erip_cop_present`             | router §5 ERIP (8.1–8.3)              |
| `p8_technical_quality`            | TQ-P8-001..010                        |
| `p8_platform_core_zero_diff`      | REQ-P8-015 · REQ-P8-051               |
| `p8_no_legacy_runtime_import`     | REQ-P8-007                            |
| `p8_urban_not_denali_rail`        | REQ-P8-022                            |
| `p8_owner_auth_specs`             | REQ-P8-010..012                       |
| `p8_urban_routes_bound`           | REQ-P8-004                            |
| `p8_smoke_map_present`            | REQ-P8-040..042                       |
| `p8_verification_matrix_hydrated` | REQ-P8-010..012 file anchors          |
| `p8_boundary_ci_hook`             | PHASE-BOUNDARY-MATRIX                 |
