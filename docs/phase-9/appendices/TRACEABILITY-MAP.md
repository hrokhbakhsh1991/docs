# Phase 9 — Master traceability map (9.0 → 9.8)

```yaml
map_version: "2026-06-08-v3"
authority: audits/verification-matrix.md · appendices/action-registry.md
subphase_matrices:
  - TRACEABILITY-MATRIX-9.1.md
  - TRACEABILITY-MATRIX-9.2.md
  - TRACEABILITY-MATRIX-9.3.md
  - TRACEABILITY-MATRIX-9.4.md
  - TRACEABILITY-MATRIX-9.5.md
  - TRACEABILITY-MATRIX-9.6.md
  - TRACEABILITY-MATRIX-9.7.md
scope: "Operator Admin PEK — execution genealogy rollup"
closure_bundle: § Closure verification bundle
```

> Single cross-subphase index. Detail matrices: [9.1](TRACEABILITY-MATRIX-9.1.md) · [9.2 shell](TRACEABILITY-MATRIX-9.2.md) · [9.3 tours list](TRACEABILITY-MATRIX-9.3.md) · [9.4 users](TRACEABILITY-MATRIX-9.4.md) · [9.5 bookings](TRACEABILITY-MATRIX-9.5.md) · [9.6 settings](TRACEABILITY-MATRIX-9.6.md) · [9.7 finance](TRACEABILITY-MATRIX-9.7.md).

---

## Master traceability table

| Requirement ID | Subphase | Design spec                                                                                                                      | Dispatch / handler                                          | Action ID           | Smoke ID              | Spec file                                               |
| -------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------- | --------------------- | ------------------------------------------------------- |
| **REQ-P9-001** | 9.0      | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                                                                            | N/A                                                         | P9-0-A01            | N/A                   | `reports/phase-9-entry-verified.yaml`                   |
| **REQ-P9-010** | 9.1      | [`IDENTITY-PORT-SCOPE.md`](IDENTITY-PORT-SCOPE.md)                                                                               | `handleRequestOtp` · `handleVerifyOtp`                      | P9-1-A02            | SMK-P9-01             | `apps/api/test/identity-otp.spec.ts`                    |
| **REQ-P9-011** | 9.1      | [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)                                                                                 | `handleGetSession` · `requireOperatorSession`               | P9-1-A03            | SMK-P9-01             | `apps/api/test/identity-session.spec.ts`                |
| **REQ-P9-012** | 9.1      | [`CANLOAD-OPERATOR-SESSION.contract.ts`](CANLOAD-OPERATOR-SESSION.contract.ts)                                                   | web guard                                                   | P9-1-A04            | SMK-P9-01             | `apps/web/test/auth-login-access.spec.ts`               |
| **REQ-P9-013** | 9.2      | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) · [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md)                     | `(app)/layout` · `OperatorShell`                            | P9-2-A01            | SMK-P9-01             | `apps/web/test/admin-shell-access.spec.ts`              |
| **REQ-P9-020** | 9.2      | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) §6                                                                                      | dashboard widget grid                                       | P9-2-A03            | SMK-P9-01             | `apps/web/test/dashboard-smoke.spec.ts`                 |
| **REQ-P9-021** | 9.2      | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md)                                                                | `force-dynamic` layout                                      | P9-2-A01            | N/A                   | CP-9.2-03                                               |
| **REQ-P9-030** | 9.3      | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) · [`tours-operator-api-dispatch-addendum.md`](tours-operator-api-dispatch-addendum.md) v2 | `listToursOperator` · `view=operator`                       | P9-3-A01            | SMK-P9-02             | `apps/api/test/tours-operator.spec.ts`                  |
| **REQ-P9-031** | 9.3      | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §5                                                                                        | `(app)/tours` card grid                                     | P9-3-A02            | SMK-P9-02             | `apps/web/test/tours-list.spec.ts`                      |
| **REQ-P9-032** | 9.3      | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §4.5                                                                                      | Denali `extractTourListProjection`                          | P9-3-A05            | N/A                   | `tour-list-projection.spec.ts`                          |
| **REQ-P9-040** | 9.4      | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §5 · [`users-api-dispatch-addendum.md`](users-api-dispatch-addendum.md)         | `handleListUsers` · `handleInviteUser`                      | P9-4-A01            | SMK-P9-03             | `apps/api/test/identity-users.spec.ts`                  |
| **REQ-P9-041** | 9.4      | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §6                                                                              | `(app)/users` directory UI                                  | P9-4-A03            | SMK-P9-03             | `apps/web/test/users-directory.spec.ts`                 |
| **REQ-P9-042** | 9.4      | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) §3 · DEC-P9-015                                                                 | hydrate + rank policy                                       | P9-4-A05            | SMK-P9-03             | `operator-ability.spec.ts`                              |
| **REQ-P9-050** | 9.5      | [`BOOKINGS-OPS-UX.md`](BOOKINGS-OPS-UX.md)                                                                                       | `listBookings` · summary · bulk                             | P9-5-A02            | SMK-P9-04             | `apps/api/test/bookings-ops.spec.ts`                    |
| **REQ-P9-051** | 9.5      | [`BOOKINGS-OPS-UX.md`](BOOKINGS-OPS-UX.md)                                                                                       | Command Center shell                                        | P9-5-A03            | SMK-P9-04 · SMK-P9-06 | `apps/web/test/bookings-command-center.spec.ts`         |
| **REQ-P9-052** | 9.5      | DEC-P9-011                                                                                                                       | manifest + leader alias                                     | P9-5-A05            | CP-9.5-08             | `bookings-ops-manifest.spec.ts`                         |
| **REQ-P9-060** | 9.6      | [`SETTINGS-MODULE-REGISTRY.md`](SETTINGS-MODULE-REGISTRY.md)                                                                     | resource + config routers                                   | P9-6-A01            | SMK-P9-05             | `apps/api/test/settings-resources.spec.ts`              |
| **REQ-P9-061** | 9.6      | [`SETTINGS-MODULE-REGISTRY.md`](SETTINGS-MODULE-REGISTRY.md)                                                                     | generic CRUD + template UI                                  | P9-6-A02            | SMK-P9-05 · SMK-P9-08 | `apps/web/test/settings-generic-crud.spec.ts`           |
| **REQ-P9-062** | 9.6      | [`SETTINGS-RISK-REGISTER-P9.md`](SETTINGS-RISK-REGISTER-P9.md)                                                                   | risk mitigations DEC-P9-009/010                             | P9-6-A03            | CP-9.6-07..10         | `settings-config-version.spec.ts`                       |
| **REQ-P9-070** | 9.7      | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §6                                                                                      | `denali-finance/*` adapters                                 | P9-7-A02            | N/A                   | `packages/workspaces/denali/test/finance-admin.spec.ts` |
| **REQ-P9-071** | 9.7      | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §5                                                                                      | `app/finance` interim · `(app)/finance` target (DEC-P9-017) | P9-7-A01            | N/A                   | `apps/web/test/finance-page.spec.ts`                    |
| **REQ-P9-072** | 9.7      | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) · reconciliation                                                                        | `(app)/settings/reconciliation-triage`                      | P9-7-A03            | N/A                   | `apps/web/test/reconciliation-triage.spec.ts`           |
| **REQ-P9-073** | 9.7      | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) §3.3                                                                                    | prepayment + schedule APIs                                  | P9-7-A04 · P9-7-A05 | N/A                   | `apps/api/test/finance-ops.spec.ts`                     |
| **REQ-P9-080** | 9.8      | [`SMOKE-SCENARIO-MAP.md`](SMOKE-SCENARIO-MAP.md)                                                                                 | E2E chain                                                   | P9-8-A02            | SMK-P9-01..08         | `apps/web/test/operator-smoke.spec.ts`                  |
| **REQ-P9-081** | 9.8      | [`subphases/9.8-operator-dod-gate.md`](../subphases/9.8-operator-dod-gate.md)                                                    | nested gate                                                 | P9-8-A01            | N/A                   | `pnpm run phase-9:gate`                                 |
| **REQ-P9-082** | 9.8      | [`subphases/9.8-operator-dod-gate.md`](../subphases/9.8-operator-dod-gate.md)                                                    | contract bundle                                             | P9-8-A01            | N/A                   | `apps/web/test/phase-9.contract.spec.ts`                |
| **REQ-P9-083** | 9.8      | [`docs/audits/phase-9-zero-debt-forensic-audit.mdoc`](../../audits/phase-9-zero-debt-forensic-audit.mdoc)                        | forensic rubric                                             | P9-8-A03            | N/A                   | mdoc `verdict: PASS` · sum ≥ 8                          |

---

## Smoke cross-walk

| Smoke ID      | Requirements                      | Actions                     | Spec anchor                                                    |
| ------------- | --------------------------------- | --------------------------- | -------------------------------------------------------------- |
| **SMK-P9-01** | REQ-P9-010..013 · REQ-P9-020      | P9-1-A02..04 · P9-2-A01..03 | `operator-smoke.spec.ts` · `auth-login-access.spec.ts`         |
| **SMK-P9-02** | REQ-P9-030..031                   | P9-3-A01..04                | `tours-operator.spec.ts` · `tours-list.spec.ts`                |
| **SMK-P9-03** | REQ-P9-040..041                   | P9-4-A01..03                | `identity-users.spec.ts` · `users-directory.spec.ts`           |
| **SMK-P9-04** | REQ-P9-050..051                   | P9-5-A02..03                | `bookings-ops.spec.ts` · `bookings-command-center.spec.ts`     |
| **SMK-P9-05** | REQ-P9-060..061                   | P9-6-A02 · P9-6-A05         | `settings-template.spec.ts`                                    |
| **SMK-P9-06** | DEC-P9-008 leader/review alias    | P9-5-A05                    | `bookings-command-center.spec.ts`                              |
| **SMK-P9-07** | DEC-P9-008 manual booking         | P9-5-A04                    | `bookings-create.spec.ts`                                      |
| **SMK-P9-08** | REQ-P9-060 · equipment round-trip | P9-6-A01 · P9-6-A02         | `settings-generic-crud.spec.ts` · `settings-resources.spec.ts` |

---

## ERIP COP cross-walk

| COP                                                                   | Subphase | Requirements                              |
| --------------------------------------------------------------------- | -------- | ----------------------------------------- |
| [`9.1-cop-identity-port.md`](erip/9.1-cop-identity-port.md)           | 9.1      | REQ-P9-010..012 · INV-P9-007              |
| [`9.2-cop-admin-shell.md`](erip/9.2-cop-admin-shell.md)               | 9.2      | REQ-P9-013 · REQ-P9-020 · DEC-P9-013      |
| [`9.3-cop-tours-operator.md`](erip/9.3-cop-tours-operator.md)         | 9.3      | REQ-P9-030..032 · DEC-P9-007 · DEC-P9-014 |
| [`9.4-cop-users-rbac.md`](erip/9.4-cop-users-rbac.md)                 | 9.4      | REQ-P9-040..042 · DEC-P9-015              |
| [`9.5-cop-bookings-ops.md`](erip/9.5-cop-bookings-ops.md)             | 9.5      | REQ-P9-050..052 · DEC-P9-011              |
| [`9.6-cop-settings-templates.md`](erip/9.6-cop-settings-templates.md) | 9.6      | REQ-P9-060..062 · DEC-P9-009/010          |
| [`9.7-cop-finance-denali.md`](erip/9.7-cop-finance-denali.md)         | 9.7      | REQ-P9-070..073 · DEC-P9-016              |
| [`9.8-cop-operator-dod.md`](erip/9.8-cop-operator-dod.md)             | 9.8      | REQ-P9-080..083                           |

---

## Closure verification bundle (9.8)

```bash
# Doc pack (fast-track)
pnpm run phase-9:guard

# 9.1 identity bundle
pnpm --filter @apps/api exec node --import tsx --test test/identity-otp.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/identity-session.spec.ts
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/operator-ability.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/auth-login-access.spec.ts

# Operator surface scaffolds (until behavioral)
pnpm --filter @apps/web exec node --import tsx --test test/admin-shell-access.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/phase-9.contract.spec.ts

# 9.6 settings registry bundle
pnpm --filter @app-tour/workspace-sdk exec node --import tsx --test test/settings-manifest.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/settings-manifest.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/settings-resources.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/settings-config-version.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/settings-generic-crud.spec.ts

# Urban regression (must stay green at 9.8)
pnpm --filter @apps/api exec node --import tsx --test test/urban-settings-patch.spec.ts

# Full closure — Architect YES only
pnpm run phase-9:gate
```
