# Phase 9.1 — Requirements traceability matrix

```yaml
matrix_version: "2026-06-08-v1"
subphase: "9.1"
authority: audits/verification-matrix.md · subphases/9.1-identity-session.md
scope: "9.1 Identity & session — execution genealogy"
prerequisite_rows: [REQ-P9-001, REQ-P9-003]
enforcement_rows: [INV-P9-007, RULE-P9-001, RULE-P9-002]
downstream_row: [REQ-P9-080]
```

---

## Master traceability table

| Requirement ID  | Design specification location                                                                                                                                | API dispatch handler                                         | Action registry ID | Smoke test ID | Target test file path                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | ------------------ | ------------- | ----------------------------------------------------- |
| **REQ-P9-001**  | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md) CP-9.0-01                                                                                              | N/A — 9.0 gate                                               | **P9-0-A01**       | N/A           | `reports/phase-9-entry-verified.yaml`                 |
| **REQ-P9-010**  | [`IDENTITY-PORT-SCOPE.md`](IDENTITY-PORT-SCOPE.md) · [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)                                                        | `handleRequestOtp` · `handleVerifyOtp`                       | **P9-1-A02**       | **SMK-P9-01** | `apps/api/test/identity-otp.spec.ts`                  |
| **REQ-P9-011**  | [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md) § hydrateMembershipFromDb                                                                                   | `handleGetSession`                                           | **P9-1-A03**       | **SMK-P9-01** | `apps/api/test/identity-session.spec.ts`              |
| **REQ-P9-012**  | [`subphases/9.1-identity-session.md`](../subphases/9.1-identity-session.md) · [`CANLOAD-OPERATOR-SESSION.contract.ts`](CANLOAD-OPERATOR-SESSION.contract.ts) | N/A — web                                                    | **P9-1-A04**       | **SMK-P9-01** | `apps/web/test/auth-login-access.spec.ts`             |
| **INV-P9-007**  | [`ADMIN-ROUTE-MATRIX.md`](ADMIN-ROUTE-MATRIX.md) · [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)                                                          | `requireOperatorSession` on protected routes                 | **P9-1-A03**       | **SMK-P9-01** | `apps/api/test/identity-session.spec.ts` (API-9.1-04) |
| **RULE-P9-001** | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) DEC-P9-003                                                                                      | N/A — path convention                                        | **P9-1-A02**       | N/A           | `docs/phase-9/appendices/IDENTITY-PORT-SCOPE.md`      |
| **RULE-P9-002** | [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md) · DEC-P9-004                                                                                                | Urban routes use `assertWorkspaceOwner` not `isAdminOrOwner` | **P9-1-A03**       | N/A           | `apps/api/test/urban-settings-patch.spec.ts` at 9.8   |
| **REQ-P9-013**  | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md) (downstream)                                                                               | N/A                                                          | **P9-2-A01**       | **SMK-P9-01** | `apps/web/test/admin-shell-access.spec.ts`            |

---

## Action registry cross-walk (P9-1-A\*)

| Action registry ID | Primary requirement IDs               | Target test file path                                   |
| ------------------ | ------------------------------------- | ------------------------------------------------------- |
| **P9-1-A01**       | REQ-P9-010                            | migration `infra/sql/005_identity_production_delta.sql` |
| **P9-1-A02**       | REQ-P9-010 · RULE-P9-001              | `apps/api/test/identity-otp.spec.ts`                    |
| **P9-1-A03**       | REQ-P9-011 · INV-P9-007 · RULE-P9-002 | `apps/api/test/identity-session.spec.ts`                |
| **P9-1-A05**       | REQ-P9-012 · DEC-P9-012               | `apps/web/test/auth-login-flow.spec.ts`                 |
| **P9-1-A06**       | DEC-P9-012                            | `apps/web/app/api/auth/**` BFF routes                   |

---

## ERIP / dispatch supplements

| Artifact                                                                 | Binds to requirement IDs             |
| ------------------------------------------------------------------------ | ------------------------------------ |
| [`erip/9.1-cop-identity-port.md`](erip/9.1-cop-identity-port.md)         | INV-P9-003 · INV-P9-007 · REQ-P9-010 |
| [`identity-api-dispatch-addendum.md`](identity-api-dispatch-addendum.md) | REQ-P9-010 · REQ-P9-011              |
| [`AGENT-STATE-MAP-9.1.yaml`](AGENT-STATE-MAP-9.1.yaml)                   | ASM-9.1-001..008                     |

---

## Smoke cross-walk (9.1 → 9.2)

| Smoke ID      | Requirement IDs                  | Action IDs              | Spec paths                                                                          |
| ------------- | -------------------------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| **SMK-P9-01** | REQ-P9-010..013 · REQ-P9-020     | P9-1-A02..04 · P9-2-A01 | `identity-otp.spec.ts` · `auth-login-access.spec.ts` · `admin-shell-access.spec.ts` |
| **SMK-P9-02** | REQ-P9-030..031 (downstream 9.3) | P9-3-A04                | `/tours/new` nav only                                                               |

---

## 9.1 verification bundle

```bash
pnpm --filter @apps/api exec node --import tsx --test test/identity-otp.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/identity-session.spec.ts
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/operator-ability.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/auth-login-access.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/auth-login-flow.spec.ts
pnpm run phase-9:guard
```
