# Phase 9.2 — Requirements traceability matrix

```yaml
matrix_version: "2026-06-08-v1"
subphase: "9.2"
authority: audits/verification-matrix.md · subphases/9.2-admin-shell.md
scope: "9.2 Admin shell — execution genealogy"
prerequisite_rows: [REQ-P9-013, REQ-P9-012]
enforcement_rows: [INV-P9-007, TQ-P9-001, TQ-P9-003]
decision_rows: [DEC-P9-001, DEC-P9-007, DEC-P9-013]
```

---

## Master traceability table

| Requirement ID | Design specification location                                                                                | Web / shell handler                           | Action registry ID | Smoke test ID | Target test file path                                   |
| -------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------- | ------------------ | ------------- | ------------------------------------------------------- |
| **REQ-P9-013** | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) · [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md) | `requireOperatorSession` · `(app)/layout.tsx` | **P9-2-A01**       | **SMK-P9-01** | `apps/web/test/admin-shell-access.spec.ts`              |
| **REQ-P9-020** | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) §6 Dashboard                                                        | `dashboard-page-client.tsx` · widget registry | **P9-2-A03**       | **SMK-P9-01** | `apps/web/test/dashboard-smoke.spec.ts`                 |
| **REQ-P9-021** | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md) CP-9.2-03                                  | `export const dynamic = 'force-dynamic'`      | **P9-2-A01**       | N/A           | `rg 'force-dynamic' apps/web/app/\\(app\\)/layout.tsx`  |
| **INV-P9-007** | [`ADMIN-ROUTE-MATRIX.md`](ADMIN-ROUTE-MATRIX.md) · [`CASL-OPERATOR-SPEC.md`](CASL-OPERATOR-SPEC.md)          | `(app)/layout` session gate                   | **P9-2-A01**       | **SMK-P9-01** | `apps/web/test/admin-shell-access.spec.ts` (WEB-9.2-01) |
| **TQ-P9-001**  | [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md) §2 · DEC-P9-013                                                     | subpath-only `@app-tour/ui-primitives/*`      | **P9-2-A02**       | N/A           | `pnpm run guard:import-boundary`                        |
| **TQ-P9-003**  | [`subphases/9.2-admin-shell.md`](../subphases/9.2-admin-shell.md) CP-9.2-04                                  | lazy workspace plugin load                    | **P9-2-A01**       | N/A           | static import guard / CP-9.2-04                         |
| **DEC-P9-007** | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)                                                 | New tour CTA → `/tours/new`                   | **P9-2-A02**       | **SMK-P9-02** | `ADMIN-SHELL-UX.md` CP-9.2-09                           |
| **DEC-P9-013** | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)                                                 | mobile-first shell on Phase 2 stack           | **P9-2-A02**       | N/A           | `ADMIN-SHELL-UX.md` · guard `p9_admin_shell_pack`       |

---

## Action registry cross-walk (P9-2-A\*)

| Action registry ID | Primary requirement IDs              | Target path / test                                             |
| ------------------ | ------------------------------------ | -------------------------------------------------------------- |
| **P9-2-A01**       | REQ-P9-013 · REQ-P9-021 · INV-P9-007 | `apps/web/app/(app)/layout.tsx` · `admin-shell-access.spec.ts` |
| **P9-2-A02**       | REQ-P9-013 · TQ-P9-001 · DEC-P9-013  | `apps/web/src/admin/shell/operator-nav.tsx` · mobile drawer    |
| **P9-2-A03**       | REQ-P9-020                           | `apps/web/app/(app)/dashboard/` · `dashboard-smoke.spec.ts`    |

---

## ERIP / UX supplements

| Artifact                                                     | Binds to requirement IDs                |
| ------------------------------------------------------------ | --------------------------------------- |
| [`erip/9.2-cop-admin-shell.md`](erip/9.2-cop-admin-shell.md) | REQ-P9-013 · REQ-P9-020 · INV-P9-007    |
| [`AGENT-STATE-MAP-9.2.yaml`](AGENT-STATE-MAP-9.2.yaml)       | ASM-9.2-001..014                        |
| [`ADMIN-SHELL-UX.md`](ADMIN-SHELL-UX.md)                     | REQ-P9-020 · DEC-P9-013 · CP-9.2-05..10 |

---

## Smoke cross-walk (9.1 → 9.2)

| Smoke ID      | Requirement IDs              | Action IDs              | Spec paths                                                                             |
| ------------- | ---------------------------- | ----------------------- | -------------------------------------------------------------------------------------- |
| **SMK-P9-01** | REQ-P9-010..013 · REQ-P9-020 | P9-1-A04 · P9-2-A01..03 | `auth-login-access.spec.ts` · `admin-shell-access.spec.ts` · `dashboard-smoke.spec.ts` |
| **SMK-P9-02** | REQ-P9-030 (downstream 9.3)  | P9-2-A02 CTA            | `/tours/new` from shell                                                                |

---

## 9.2 verification bundle

```bash
pnpm --filter @apps/web exec node --import tsx --test test/admin-shell-access.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/dashboard-smoke.spec.ts
pnpm run guard:import-boundary
pnpm run phase-9:guard
```
