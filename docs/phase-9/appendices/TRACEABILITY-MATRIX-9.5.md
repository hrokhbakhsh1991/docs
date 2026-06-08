# Phase 9.5 — Bookings ops traceability matrix

```yaml
matrix_id: TRACEABILITY-MATRIX-9.5
version: "2026-06-08-v1"
authority: BOOKINGS-OPS-UX.md · bookings-api-dispatch-addendum.md
subphase: "9.5"
decisions: [DEC-P9-006, DEC-P9-008, DEC-P9-011]
```

| REQ / Risk                            | Spec / DEC              | Handler / surface                  | Action   | Smoke / CP | Spec file                         |
| ------------------------------------- | ----------------------- | ---------------------------------- | -------- | ---------- | --------------------------------- |
| **REQ-P9-050**                        | BOOKINGS-OPS-UX §6      | `GET /bookings` · summary          | P9-5-A02 | SMK-P9-04  | `bookings-ops.spec.ts`            |
| **REQ-P9-051**                        | BOOKINGS-OPS-UX §3      | `features/bookings/command-center` | P9-5-A03 | SMK-P9-04  | `bookings-command-center.spec.ts` |
| **REQ-P9-052**                        | DEC-P9-011              | manifest + leader alias            | P9-5-A05 | CP-9.5-08  | `bookings-ops-manifest.spec.ts`   |
| **P9-F-006**                          | TQ-P9-006               | approve txn + outbox               | P9-5-A02 | CP-9.5-05  | `bookings-ops.spec.ts`            |
| **DEC-P9-008**                        | manual create           | `POST /bookings`                   | P9-5-A04 | SMK-P9-07  | `bookings-create.spec.ts`         |
| **Legacy `/leader/review` URL alias** | DEC-P9-011 · DEC-P9-015 | `/leader/review` · admin session   | P9-5-A05 | SMK-P9-06  | `bookings-command-center.spec.ts` |

## SDK / Denali proof

| ID         | Artifact                          | Command                                                                            |
| ---------- | --------------------------------- | ---------------------------------------------------------------------------------- |
| SDK-9.5-01 | `validateRegistrationOpsManifest` | `pnpm --filter @app-tour/workspace-sdk test test/bookings-ops-manifest.spec.ts`    |
| DN-9.5-01  | `denaliRegistrationOpsManifest`   | `pnpm --filter @app-tour/workspace-denali test test/bookings-ops-manifest.spec.ts` |

## Route unification map

| Legacy path                    | Phase 9 target                                 | Notes                      |
| ------------------------------ | ---------------------------------------------- | -------------------------- |
| `(app)/leader/review`          | `(app)/bookings?view=inbox_table&scope=leader` | Alias route — shared shell |
| `(app)/bookings` (participant) | `(app)/bookings` `view=mine` for member        | Same URL, CASL split       |
| `(app)/bookings/new`           | unchanged                                      | Manual create              |
| `(app)/bookings/[id]`          | inbox + focused inspection                     | Deep link                  |
