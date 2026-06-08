# Phase 9.3 — Requirements traceability matrix (tours list focus)

```yaml
matrix_version: "2026-06-08-v1"
subphase: "9.3"
authority: audits/verification-matrix.md · subphases/9.3-tours-operator.md
scope: "9.3 Tours list — execution genealogy (edit/workspace in separate rows)"
prerequisite_rows: [REQ-P9-013, REQ-P9-020]
enforcement_rows: [INV-P9-005, INV-P9-007, TQ-P9-004]
decision_rows: [DEC-P9-007, DEC-P9-014]
```

---

## Master traceability table (list)

| Requirement ID | Design specification location                                                                                                    | API / web handler                      | Action registry ID | Smoke test ID | Target test file path                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------------------ | ------------- | -------------------------------------------------------------- |
| **REQ-P9-030** | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §4 · [`tours-operator-api-dispatch-addendum.md`](tours-operator-api-dispatch-addendum.md) | `listTours` · `listToursOperator`      | **P9-3-A01**       | **SMK-P9-02** | `apps/api/test/tours-operator.spec.ts`                         |
| **REQ-P9-031** | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §5                                                                                        | `(app)/tours` · `tours-list-view.tsx`  | **P9-3-A02**       | **SMK-P9-02** | `apps/web/test/tours-list.spec.ts`                             |
| **REQ-P9-032** | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §4.5 Denali extractor                                                                     | `packages/workspaces/denali/src/list/` | **P9-3-A05**       | N/A           | `packages/workspaces/denali/test/tour-list-projection.spec.ts` |
| **INV-P9-007** | [`ADMIN-ROUTE-MATRIX.md`](ADMIN-ROUTE-MATRIX.md)                                                                                 | `requireOperatorSession` on GET /tours | **P9-3-A01**       | SMK-P9-02     | API-9.3-L01                                                    |
| **INV-P9-005** | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §4.2                                                                                      | no dual-write · projection only        | **P9-3-A01**       | N/A           | canonical regression                                           |
| **TQ-P9-004**  | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) CP-9.3-L05                                                                                | tenant-scoped list query               | **P9-3-A01**       | N/A           | ASM-9.3-009                                                    |
| **DEC-P9-007** | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)                                                                     | create/clone → `/tours/new`            | **P9-3-A04**       | SMK-P9-02     | WEB-9.3-02 · CP-9.3-L09                                        |
| **DEC-P9-014** | [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md)                                                                     | `view=operator` projection             | **P9-3-A01**       | N/A           | CP-9.3-L01..04                                                 |

---

## Action registry cross-walk (list subset)

| Action registry ID | Primary requirement IDs | Target path / test                                              |
| ------------------ | ----------------------- | --------------------------------------------------------------- |
| **P9-3-A01**       | REQ-P9-030 · DEC-P9-014 | `apps/api/src/tours/list.handler.ts` · `tours-operator.spec.ts` |
| **P9-3-A02**       | REQ-P9-031              | `apps/web/app/(app)/tours/` · `tours-list.spec.ts`              |
| **P9-3-A04**       | DEC-P9-007              | create CTA + clone query                                        |
| **P9-3-A05**       | REQ-P9-032              | Denali `extractTourListProjection`                              |

---

## Completion proof cross-walk

| Proof ID       | Requirement IDs         | Spec                                      |
| -------------- | ----------------------- | ----------------------------------------- |
| CP-9.3-L01..15 | REQ-P9-030 · REQ-P9-031 | [`TOURS-LIST-UX.md`](TOURS-LIST-UX.md) §7 |
| CP-9.3-01      | REQ-P9-030              | tenant scope (alias L05)                  |
| CP-9.3-04      | REQ-P9-031              | web list RTL/happy-dom                    |

---

## ERIP / UX supplements

| Artifact                                                                                 | Binds to requirement IDs     |
| ---------------------------------------------------------------------------------------- | ---------------------------- |
| [`erip/9.3-cop-tours-operator.md`](erip/9.3-cop-tours-operator.md)                       | REQ-P9-030..032 · DEC-P9-014 |
| [`AGENT-STATE-MAP-9.3.yaml`](AGENT-STATE-MAP-9.3.yaml)                                   | ASM-9.3-001..018             |
| [`schemas/TOURS-LIST-PROJECTION.schema.json`](schemas/TOURS-LIST-PROJECTION.schema.json) | DEC-P9-014                   |

---

## Smoke cross-walk

| Smoke ID      | Requirement IDs         | Action IDs   | Spec paths                                                                 |
| ------------- | ----------------------- | ------------ | -------------------------------------------------------------------------- |
| **SMK-P9-02** | REQ-P9-030 · REQ-P9-031 | P9-3-A01..04 | `tours-operator.spec.ts` · `tours-list.spec.ts` · wizard → list appearance |

---

## 9.3 list verification bundle

```bash
pnpm --filter @apps/api exec node --import tsx --test test/tours-operator.spec.ts
pnpm --filter @apps/api exec node --import tsx --test test/1-functional/tours-list.spec.ts
pnpm --filter @apps/web exec node --import tsx --test test/tours-list.spec.ts
pnpm --filter @app-tour/workspace-denali exec node --import tsx --test test/tour-list-projection.spec.ts
pnpm run phase-9:guard
```
