# Phase 9 — Action registry

```yaml
registry_version: "2026-06-08-v2"
authority: phase-9-charter.md · TRACEABILITY-MAP.md
index: PRECISION-DOC-INDEX.md
action_count: 38
cross_cutting: TRACEABILITY-MAP.md § Master traceability table
```

> Canonical ledger for every `P9-*-A*` action ID. **Verification evidence** is the forensic artifact an auditor must find — not narrative claims.

---

## Index

| action_id     | subphase | spec file                                                                                                                                                                     |
| ------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P9-0-A01      | 9.0      | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                                                                                                                         |
| P9-0-A02      | 9.0      | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                                                                                                                         |
| P9-0-A03      | 9.0      | [`subphases/9.0-entry.md`](../subphases/9.0-entry.md)                                                                                                                         |
| P9-0-A04      | 9.0      | [`audits/IMPLEMENTATION-TRUTH.md`](../audits/IMPLEMENTATION-TRUTH.md)                                                                                                         |
| P9-1-A01..A06 | 9.1      | [`subphases/9.1-identity-session.md`](../subphases/9.1-identity-session.md) · [`OPERATOR-LOGIN-FLOW.md`](OPERATOR-LOGIN-FLOW.md)                                              |
| P9-2-A01..A03 | 9.2      | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md) · [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md)                                                                  |
| P9-3-A01..A06 | 9.3      | [`subphases/9.3-tours-operator.md`](../subphases/9.3-tours-operator.md) · [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) · [`TRACEABILITY-MATRIX-9.3.md`](TRACEABILITY-MATRIX-9.3.md) |
| P9-4-A01..A03 | 9.4      | [`subphases/9.4-users-rbac.md`](../subphases/9.4-users-rbac.md)                                                                                                               |
| P9-5-A01..A06 | 9.5      | [`subphases/9.5-bookings-ops.md`](../subphases/9.5-bookings-ops.md) · [`TRACEABILITY-MATRIX-9.5.md`](TRACEABILITY-MATRIX-9.5.md)                                              |
| P9-6-A01..A06 | 9.6      | [`subphases/9.6-settings-templates.md`](../subphases/9.6-settings-templates.md) · [`TRACEABILITY-MATRIX-9.6.md`](TRACEABILITY-MATRIX-9.6.md)                                  |
| P9-7-A01..A05 | 9.7      | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) · DEC-P9-016                                                                                                                         |
| P9-8-A01..A04 | 9.8      | [`subphases/9.8-operator-dod-gate.md`](../subphases/9.8-operator-dod-gate.md)                                                                                                 |

---

## Subphase 9.0 — Entry

### P9-0-A01 — Run phase-8:gate

| Field                     | Value                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------- |
| **Responsible actor**     | DevOps CI                                                                          |
| **Verification evidence** | CI log `pnpm run phase-8:gate` exit 0 · `reports/phase-8-gate-*.json` `"ok": true` |

### P9-0-A02 — Write phase-9 entry yaml

| Field                     | Value                                                                                         |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| **Verification evidence** | `reports/phase-9-entry-verified.yaml` — `phase_8_gate.status: PASS` · `map_35_reviewed: true` |

---

## Subphase 9.1 — Identity

### P9-1-A02 — Auth OTP routes

| Field                     | Value                                                                   |
| ------------------------- | ----------------------------------------------------------------------- |
| **Verification evidence** | `apps/api/test/identity-otp.spec.ts` · API-9.1-01..02 · SMK-P9-01 chain |

### P9-1-A03 — Session hydrate + requireOperatorSession

| Field                     | Value                                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Verification evidence** | `apps/api/test/identity-session.spec.ts` · API-9.1-03..04 · `packages/workspace-sdk/test/operator-ability.spec.ts` |

### P9-1-A04 — Web login guard

| Field                     | Value                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Verification evidence** | `apps/web/test/auth-login-access.spec.ts` · WEB-9.1-01 · [`CANLOAD-OPERATOR-SESSION.contract.ts`](CANLOAD-OPERATOR-SESSION.contract.ts) |

### P9-1-A05 — BFF login flow (legacy parity)

| Field                     | Value                                                                             |
| ------------------------- | --------------------------------------------------------------------------------- |
| **Verification evidence** | `apps/web/test/auth-login-flow.spec.ts` · BFF-9.1-01..03 · DEC-P9-012 · SMK-P9-01 |

### P9-1-A06 — Web BFF auth routes

| Field                     | Value                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| **Verification evidence** | [`identity-web-bff-addendum.md`](identity-web-bff-addendum.md) · CP-9.1-06..08 |

---

## Subphase 9.2 — Admin shell

### P9-2-A01 — `(app)/layout` session guard

| Field                     | Value                                                                       |
| ------------------------- | --------------------------------------------------------------------------- |
| **Design spec**           | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) §7                                 |
| **Verification evidence** | `apps/web/test/admin-shell-access.spec.ts` · WEB-9.2-01..03 · CP-9.2-01..04 |

### P9-2-A02 — Operator nav + mobile drawer

| Field                     | Value                                          |
| ------------------------- | ---------------------------------------------- |
| **Design spec**           | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) §3–§4 |
| **Verification evidence** | CP-9.2-05..06 · ASM-9.2-013 · DEC-P9-013       |

### P9-2-A03 — Dashboard widget grid

| Field                     | Value                                                |
| ------------------------- | ---------------------------------------------------- |
| **Design spec**           | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) §6          |
| **Verification evidence** | `apps/web/test/dashboard-smoke.spec.ts` · REQ-P9-020 |

---

## Subphase 9.3 — Tours list

### P9-3-A01 — Operator list API (`view=operator`)

| Field                     | Value                                                                     |
| ------------------------- | ------------------------------------------------------------------------- |
| **Design spec**           | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §4 · DEC-P9-014                    |
| **Verification evidence** | `apps/api/test/tours-operator.spec.ts` · API-9.3-L01..04 · CP-9.3-L01..05 |

### P9-3-A02 — `(app)/tours` list UI

| Field                     | Value                                                                |
| ------------------------- | -------------------------------------------------------------------- |
| **Design spec**           | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §5                            |
| **Verification evidence** | `apps/web/test/tours-list.spec.ts` · WEB-9.3-01..05 · CP-9.3-L06..08 |

### P9-3-A04 — Wizard nav to `/tours/new`

| Field                     | Value                                                                                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------------- |
| **Verification evidence** | `apps/web/test/tours-list.spec.ts` WEB-9.3-02 · DEC-P9-007 · CP-9.3-L09 · zero `(app)/tours/new` routes |

### P9-3-A05 — Denali list projection extractor

| Field                     | Value                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **Design spec**           | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §4.5                                              |
| **Verification evidence** | `packages/workspaces/denali/test/tour-list-projection.spec.ts` · REQ-P9-032 · CP-9.3-L12 |

---

## Subphase 9.8 — Closure

### P9-8-A01 — phase-9.contract.spec.ts

| Field                     | Value                                                        |
| ------------------------- | ------------------------------------------------------------ |
| **Verification evidence** | `apps/web/test/phase-9.contract.spec.ts` exit 0 · REQ-P9-082 |

### P9-8-A02 — operator-smoke.spec.ts

| Field                     | Value                                                                         |
| ------------------------- | ----------------------------------------------------------------------------- |
| **Verification evidence** | `apps/web/test/operator-smoke.spec.ts` · SMK-P9-01..08 grep pass · REQ-P9-080 |

### P9-8-A03 — Forensic audit

| Field                     | Value                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| **Verification evidence** | `docs/audits/phase-9-zero-debt-forensic-audit.mdoc` · `verdict: PASS` · sum ≥ 8 · REQ-P9-083 |

---

## Per-subphase summary tables

### 9.2 Admin shell

| Action ID | Target                      | Spec                                                                    |
| --------- | --------------------------- | ----------------------------------------------------------------------- |
| P9-2-A01  | `(app)/layout.tsx`          | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) · `admin-shell-access.spec.ts` |
| P9-2-A02  | `operator-nav.tsx` · drawer | CP-9.2-05..06                                                           |
| P9-2-A03  | `(app)/dashboard`           | `dashboard-smoke.spec.ts`                                               |

### 9.3 Tours list

| Action ID | Target                              | Spec                                                              |
| --------- | ----------------------------------- | ----------------------------------------------------------------- |
| P9-3-A01  | `list.handler.ts` · `view=operator` | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) · `tours-operator.spec.ts` |
| P9-3-A02  | `(app)/tours` · card grid           | `tours-list.spec.ts`                                              |
| P9-3-A04  | wizard CTA `/tours/new`             | DEC-P9-007                                                        |
| P9-3-A05  | Denali projection extractor         | `tour-list-projection.spec.ts`                                    |

### 9.4 Users — 3-tier RBAC (DEC-P9-015)

| Action ID | Target                               | Spec                                                                        |
| --------- | ------------------------------------ | --------------------------------------------------------------------------- |
| P9-4-A01  | users API list · role · remove       | [`USERS-DIRECTORY-UX.md`](USERS-DIRECTORY-UX.md) · `identity-users.spec.ts` |
| P9-4-A02  | invites API create · revoke · accept | `users-api-dispatch-addendum.md` v2 · CP-9.4-03                             |
| P9-4-A03  | `(app)/users` directory shell        | `users-directory.spec.ts`                                                   |
| P9-4-A04  | invite modal · pending tab · CSV     | USERS-DIRECTORY-UX §6                                                       |
| P9-4-A05  | 3-tier hydrate · rank policy         | DEC-P9-015 · REQ-P9-042                                                     |

### 9.5 Bookings — Registration Command Center

| Action ID | Target                            | Spec                                        |
| --------- | --------------------------------- | ------------------------------------------- |
| P9-5-A01  | migration 006                     | DDL apply                                   |
| P9-5-A02  | bookings API + summary + bulk     | `bookings-ops.spec.ts`                      |
| P9-5-A03  | Command Center shell + inspection | `bookings-command-center.spec.ts`           |
| P9-5-A04  | manual create                     | `bookings-create.spec.ts` · SMK-P9-07       |
| P9-5-A05  | leader/review alias + manifest    | `bookings-ops-manifest.spec.ts` · CP-9.5-08 |
| P9-5-A06  | member mine view CASL             | `bookings-ops.spec.ts` · CP-9.5-04          |

### 9.6 Settings registry

| Action ID | Target                                    | Spec                                                               |
| --------- | ----------------------------------------- | ------------------------------------------------------------------ |
| P9-6-A01  | `/settings/resources/{moduleId}` router   | `settings-resources.spec.ts` · CP-9.6-07                           |
| P9-6-A02  | generic CRUD + hub nav                    | `settings-generic-crud.spec.ts` · CP-9.6-05                        |
| P9-6-A03  | config version + audit read-only          | `settings-config-version.spec.ts` · `settings-audit-trail.spec.ts` |
| P9-6-A04  | RLS + tenant kernel on resource mutations | `settings-resources.spec.ts` · CP-9.6-08                           |
| P9-6-A05  | config PUT + cache invalidate             | `settings-template.spec.ts` · SMK-P9-05                            |
| P9-6-A06  | urban owner regression guard              | `urban-settings-patch.spec.ts` · P9-F-007                          |

### 9.7 Finance — Command Center (DEC-P9-016)

| Action ID | Target                                          | Spec                                                              |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| P9-7-A01  | `app/finance` tabbed hub (interim · DEC-P9-017) | [`FINANCE-OPS-UX.md`](FINANCE-OPS-UX.md) · `finance-page.spec.ts` |
| P9-7-A02  | `denali-finance/*` API adapters                 | `finance-admin.spec.ts` · `finance-ops.spec.ts`                   |
| P9-7-A03  | reconciliation triage explorer                  | `reconciliation-triage.spec.ts`                                   |
| P9-7-A04  | prepayment record + invoice read                | CP-9.7-10..11                                                     |
| P9-7-A05  | installment schedule generator + board          | CP-9.7-12..14                                                     |
