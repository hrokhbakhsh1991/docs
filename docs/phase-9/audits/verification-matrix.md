# Phase 9 — Verification matrix (REQ-P9 · RULE-P9)

```yaml
matrix_version: "2026-06-08-v1"
req_foundation_range: REQ-P9-001..REQ-P9-015
req_extended_range: REQ-P9-020..REQ-P9-082
command_atlas: this file § Subphase proof bundles
route_matrix: ../appendices/ADMIN-ROUTE-MATRIX.md
product_scope: ../appendices/OPERATOR-PRODUCT-SCOPE.md
sole_router: ../phase-9-agent-router.md
```

## Honesty

Rows reference **TARGET** paths until implementation lands. Status `ABSENT` in [`IMPLEMENTATION-TRUTH.md`](IMPLEMENTATION-TRUTH.md) means commands may fail until subphase closes.

**Scaffold policy (2026-06-08):** **T-9.1** scaffolds are **ON_TRUNK** — `pnpm run phase-9:guard` → **32/32 PASS**. Trains **T-9.2+** may still reference [`TEMP/phase9-wip-specs/README.md`](../../../TEMP/phase9-wip-specs/README.md) until promoted.

---

## Foundation matrix — REQ-P9-001..REQ-P9-015

| REQ ID         | Subphase | Claim                               | Spec file                                                                         | Verification command                                                                                                                                                                              |
| -------------- | -------- | ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REQ-P9-001** | 9.0      | Phase 8 product gate closed         | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                             | `pnpm run phase-8:gate`                                                                                                                                                                           |
| **REQ-P9-002** | 9.0      | Entry ledger scaffold               | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                             | `test -f reports/phase-9-entry-verified.yaml && rg 'phase_8_gate' reports/phase-9-entry-verified.yaml`                                                                                            |
| **REQ-P9-003** | 9.0      | No legacy runtime import            | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                             | `rg "from ['\"]legacy/" apps/api apps/web && exit 1 \|\| exit 0`                                                                                                                                  |
| **REQ-P9-004** | 9.0      | Admin route matrix authoritative    | [`appendices/ADMIN-ROUTE-MATRIX.md`](../appendices/ADMIN-ROUTE-MATRIX.md)         | `test -f docs/phase-9/appendices/ADMIN-ROUTE-MATRIX.md`                                                                                                                                           |
| **REQ-P9-005** | 9.0      | Operator product scope documented   | [`appendices/OPERATOR-PRODUCT-SCOPE.md`](../appendices/OPERATOR-PRODUCT-SCOPE.md) | `test -f docs/phase-9/appendices/OPERATOR-PRODUCT-SCOPE.md`                                                                                                                                       |
| **REQ-P9-006** | 9.0      | Verification matrix self-consistent | this file                                                                         | `rg -c '^\| \*\*REQ-P9-' docs/phase-9/audits/verification-matrix.md` ≥ 15                                                                                                                         |
| **REQ-P9-007** | 9.0      | Legacy admin reference indexed      | [`appendices/LEGACY-ADMIN-REFERENCE.md`](../appendices/LEGACY-ADMIN-REFERENCE.md) | `rg 'legacy/apps/web/app/\\(app\\)' docs/phase-9/appendices/LEGACY-ADMIN-REFERENCE.md`                                                                                                            |
| **REQ-P9-008** | 9.0      | MAP §3.5 reviewed at entry          | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                             | `rg 'map_35_reviewed:\s*true' reports/phase-9-entry-verified.yaml`                                                                                                                                |
| **REQ-P9-009** | 9.0      | Genericity baseline for 9.x         | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                             | `test -f reports/phase-9-genericity-baseline.yaml \|\| test -f reports/phase-8-genericity-baseline.yaml`                                                                                          |
| **REQ-P9-010** | 9.1      | OTP request + verify                | [`appendices/IDENTITY-PORT-SCOPE.md`](../appendices/IDENTITY-PORT-SCOPE.md)       | `pnpm --filter @apps/api exec node --import tsx --test test/identity-otp.spec.ts`                                                                                                                 |
| **REQ-P9-011** | 9.1      | Session hydrate from DB             | [`subphases/9.1-identity-session.md`](../subphases/9.1-identity-session.md)       | `pnpm --filter @apps/api exec node --import tsx --test test/identity-session.spec.ts`                                                                                                             |
| **REQ-P9-012** | 9.1      | Web login access                    | [`subphases/9.1-identity-session.md`](../subphases/9.1-identity-session.md)       | `pnpm --filter @apps/web exec node --import tsx --test test/auth-login-access.spec.ts`                                                                                                            |
| **REQ-P9-013** | 9.2      | Admin shell session guard           | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md)                 | `pnpm --filter @apps/web exec node --import tsx --test test/admin-shell-access.spec.ts`                                                                                                           |
| **REQ-P9-014** | 9.x      | platform-core zero diff             | charter INV-P9-001                                                                | `git diff "$(yq -r .baseline_sha reports/phase-9-genericity-baseline.yaml 2>/dev/null \|\| yq -r .baseline_sha reports/phase-8-genericity-baseline.yaml)" -- packages/platform-core \| test ! -s` |
| **REQ-P9-015** | 9.x      | Import boundary                     | all subphases                                                                     | `pnpm run guard:import-boundary`                                                                                                                                                                  |

---

## Forbidden catalog — P9-F-\*

| ID           | Subphase | Rule                                                            | Detection                                                 |
| ------------ | -------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| **P9-F-001** | 9.0      | Phase 9 started without `phase-8:gate` exit 0                   | `phase_8_gate.exit_code` must be `0` in entry yaml        |
| **P9-F-002** | 9.1      | Protected route without session returns 200 empty               | `identity-session.spec.ts` API-9.1-04                     |
| **P9-F-003** | 9.2      | `(app)/` layout not force-dynamic                               | CP-9.2-03                                                 |
| **P9-F-004** | 9.3      | Duplicate wizard at `(app)/tours/new`                           | DEC-P9-007 · rg `(app)/tours/new`                         |
| **P9-F-005** | 9.4      | Member can POST `/users/invite`                                 | `identity-users.spec.ts`                                  |
| **P9-F-006** | 9.5      | Approve booking without outbox transaction                      | TQ-P9-006                                                 |
| **P9-F-007** | 9.6      | Urban admin PATCH settings 200 for admin role                   | urban-settings-patch regression                           |
| **P9-F-008** | 9.7      | `apps/api/src/modules/finance` Nest tree                        | tree audit                                                |
| **P9-F-009** | 9.8      | Doc-guard-only closure without `phase-9:gate`                   | AH-9.8-01                                                 |
| **P9-F-010** | 9.6      | Generic JSON table for catalog entities (destinations · themes) | DEC-P9-010 · AH-9.6-05 · no `settings_catalog_json` table |

---

## INV-P9 cross-reference

| Invariant  | Primary REQ            | Proof                          |
| ---------- | ---------------------- | ------------------------------ |
| INV-P9-001 | REQ-P9-014             | platform-core zero diff        |
| INV-P9-004 | REQ-P9-003             | no legacy import               |
| INV-P9-005 | REQ-P9-030             | canonical SoT specs            |
| INV-P9-006 | REQ-P9-070             | denali finance only            |
| INV-P9-007 | REQ-P9-011, REQ-P9-013 | identity-session · admin-shell |
| INV-P8-007 | REQ-P9-061             | urban owner regression at 9.8  |

---

## Extended matrix — REQ-P9-020..REQ-P9-083

| REQ ID         | Subphase | Claim                                                                           | Spec file                                                                                                                       | Verification command                                                                                                                                                                  |
| -------------- | -------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **REQ-P9-020** | 9.2      | Dashboard smoke                                                                 | [`ADMIN-SHELL-UX.md`](../appendices/ADMIN-SHELL-UX.md) · `dashboard-smoke.spec.ts`                                              | `pnpm --filter @apps/web exec node --import tsx --test test/dashboard-smoke.spec.ts`                                                                                                  |
| **REQ-P9-021** | 9.2      | `(app)/layout` force-dynamic                                                    | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md) · [`ADMIN-SHELL-UX.md`](../appendices/ADMIN-SHELL-UX.md)      | `rg 'force-dynamic' apps/web/app/\\(app\\)/layout.tsx`                                                                                                                                |
| **REQ-P9-030** | 9.3      | Tour list API (`view=operator`)                                                 | [`TOURS-LIST-UX.md`](../appendices/TOURS-LIST-UX.md) · `tours-operator.spec.ts`                                                 | `pnpm --filter @apps/api exec node --import tsx --test test/tours-operator.spec.ts`                                                                                                   |
| **REQ-P9-031** | 9.3      | Tour list UI (card grid)                                                        | [`TOURS-LIST-UX.md`](../appendices/TOURS-LIST-UX.md) · `tours-list.spec.ts`                                                     | `pnpm --filter @apps/web exec node --import tsx --test test/tours-list.spec.ts`                                                                                                       |
| **REQ-P9-032** | 9.3      | Denali list projection                                                          | [`TOURS-LIST-PROJECTION.schema.json`](../appendices/schemas/TOURS-LIST-PROJECTION.schema.json) · `tour-list-projection.spec.ts` | `pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/tour-list-projection.spec.ts`                                                                            |
| **REQ-P9-040** | 9.4      | Users API                                                                       | `apps/api/test/identity-users.spec.ts`                                                                                          | `pnpm --filter @apps/api exec node --import tsx --test test/identity-users.spec.ts`                                                                                                   |
| **REQ-P9-041** | 9.4      | Users UI directory                                                              | `apps/web/test/users-directory.spec.ts`                                                                                         | `pnpm --filter @apps/web exec node --import tsx --test test/users-directory.spec.ts`                                                                                                  |
| **REQ-P9-042** | 9.4      | 3-tier RBAC · DEC-P9-015                                                        | `packages/workspace-sdk/test/operator-ability.spec.ts`                                                                          | `pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/operator-ability.spec.ts`                                                                                   |
| **REQ-P9-050** | 9.5      | Bookings API + summary + bulk                                                   | `apps/api/test/bookings-ops.spec.ts`                                                                                            | `pnpm --filter @apps/api exec node --import tsx --test test/bookings-ops.spec.ts`                                                                                                     |
| **REQ-P9-051** | 9.5      | Registration Command Center UI                                                  | `apps/web/test/bookings-command-center.spec.ts`                                                                                 | `pnpm --filter @apps/web exec node --import tsx --test test/bookings-command-center.spec.ts`                                                                                          |
| **REQ-P9-052** | 9.5      | Ops manifest + leader alias                                                     | `packages/workspace-sdk/test/bookings-ops-manifest.spec.ts`                                                                     | `pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/bookings-ops-manifest.spec.ts`                                                                              |
| **REQ-P9-060** | 9.6      | Settings resource router (manifest dispatch)                                    | `apps/api/test/settings-resources.spec.ts`                                                                                      | `pnpm --filter @apps/api exec node --import tsx --test test/settings-resources.spec.ts`                                                                                               |
| **REQ-P9-061** | 9.6      | Generic CRUD + template UI                                                      | `apps/web/test/settings-generic-crud.spec.ts` · `settings-template.spec.ts`                                                     | `pnpm --filter @apps/web exec node --import tsx --test test/settings-generic-crud.spec.ts test/settings-template.spec.ts`                                                             |
| **REQ-P9-062** | 9.6      | Config version + audit read-only + manifest validation                          | `apps/api/test/settings-config-version.spec.ts` · `settings-audit-trail.spec.ts` · SDK/denali manifest specs                    | `pnpm --filter @apps/api exec node --import tsx --test test/settings-config-version.spec.ts test/settings-audit-trail.spec.ts`                                                        |
| **REQ-P9-070** | 9.7      | Denali finance adapters · **PARTIAL_R1**                                        | `packages/workspaces/denali/test/finance-admin.spec.ts` · `apps/api/test/finance-ops.spec.ts`                                   | `pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/finance-admin.spec.ts && pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts` |
| **REQ-P9-071** | 9.7      | Finance Command Center UI · **PARTIAL_R1** (interim `app/finance` · DEC-P9-017) | `apps/web/test/finance-page.spec.ts`                                                                                            | `pnpm --filter @apps/web exec node --import tsx --test test/finance-page.spec.ts`                                                                                                     |
| **REQ-P9-072** | 9.7      | Reconciliation triage R1 findings board · E2E SMK-P9-11                         | `apps/web/test/reconciliation-triage.spec.ts` · `operator-smoke.spec.ts` SMK-P9-11                                            | `pnpm --filter @apps/web exec node --import tsx --test test/reconciliation-triage.spec.ts`                                                                                            |
| **REQ-P9-073** | 9.7      | Manual pay + receipts · **PARTIAL_R1** · prepayment/installments R2–R3          | `apps/api/test/finance-ops.spec.ts`                                                                                             | `pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts`                                                                                                      |
| **REQ-P9-080** | 9.8      | Playwright operator smoke                                                       | `apps/web/test/operator-smoke.spec.ts`                                                                                          | `pnpm --filter @apps/web exec node --import tsx --test test/operator-smoke.spec.ts`                                                                                                   |
| **REQ-P9-081** | 9.8      | Phase 9 nested gate                                                             | [`subphases/9.8-operator-dod-gate.md`](../subphases/9.8-operator-dod-gate.md)                                                   | `pnpm run phase-9:gate`                                                                                                                                                               |
| **REQ-P9-082** | 9.8      | Operator contract spec                                                          | `apps/web/test/phase-9.contract.spec.ts`                                                                                        | `pnpm --filter @apps/web exec node --import tsx --test test/phase-9.contract.spec.ts`                                                                                                 |
| **REQ-P9-083** | 9.8      | Forensic audit ≥ 8.0                                                            | [`docs/audits/phase-9-zero-debt-forensic-audit.mdoc`](../../audits/phase-9-zero-debt-forensic-audit.mdoc)                       | `rg 'verdict:\s*PASS' docs/audits/phase-9-zero-debt-forensic-audit.mdoc`                                                                                                              |

---

## RULE-P9 enforcement matrix

| RULE ID         | Subphase | Rule                                                                          | Verification                                                                                                           |
| --------------- | -------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **RULE-P9-001** | 9.1      | Identity modules under `apps/api/src/identity/**` — no Nest port tree         | `test -d docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md` + path convention review                                      |
| **RULE-P9-002** | 9.4      | Denali admin uses `isAdminOrOwner` — Urban owner uses `isWorkspaceOwner` only | urban-owner regression + CASL specs                                                                                    |
| **RULE-P9-003** | 9.3      | Wizard at `/tours/new` only — no `(app)/tours/new`                            | `rg '\\(app\\)/tours/new' apps/web` → zero                                                                             |
| **RULE-P9-010** | 9.8      | `phase-9:gate` chains `phase-8:gate`                                          | `node -e "const p=require('./package.json'); if(!p.scripts['phase-9:gate'].includes('phase-8:gate')) process.exit(1)"` |

---

## Smoke command index (9.8)

| SMK ID    | Command                                                               |
| --------- | --------------------------------------------------------------------- |
| SMK-P9-01 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-01'` |
| SMK-P9-02 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-02'` |
| SMK-P9-03 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-03'` |
| SMK-P9-04 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-04'` |
| SMK-P9-05 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-05'` |
| SMK-P9-06 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-06'` |
| SMK-P9-07 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-07'` |
| SMK-P9-08 | `pnpm --filter @apps/web run test:e2e:operator -- --grep 'SMK-P9-08'` |

---

## Subphase proof bundles

```bash
# 9.0
pnpm run phase-8:gate && pnpm run guard:import-boundary

# 9.1
pnpm --filter @apps/api exec node --import tsx --test test/identity-otp.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/identity-session.spec.ts

# 9.5
pnpm --filter @apps/api exec node --import tsx --test test/bookings-ops.spec.ts

# 9.1 identity + BFF login
pnpm --filter @apps/api exec node --import tsx --test test/identity-otp.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/identity-session.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/auth-login-flow.spec.ts

# 9.5 — Registration Command Center (DEC-P9-011)
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/bookings-ops-manifest.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/bookings-ops-manifest.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/bookings-ops.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/bookings-command-center.spec.ts

# 9.6 — settings registry (DEC-P9-009 · DEC-P9-010)
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/settings-manifest.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/settings-manifest.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/settings-resources.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/settings-config-version.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/settings-audit-trail.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/settings-generic-crud.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/settings-template.spec.ts

# 9.7 — finance R1 (PARTIAL_R1 · DEC-P9-016 · DEC-P9-017)
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/finance-admin.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/finance-ops.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/finance-page.spec.ts

# 9.8
pnpm run phase-9:guard
pnpm run phase-9:gate   # Architect YES only
```
