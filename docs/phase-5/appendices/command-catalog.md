# Command catalog

| Command                        | Purpose                  | Subphase | Pass             |
| ------------------------------ | ------------------------ | -------- | ---------------- |
| `pnpm run phase-4:gate`        | Phase 5 entry            | 5.0      | exit 0           |
| `pnpm build`                   | Build monorepo           | all      | exit 0           |
| `pnpm test`                    | Unit/integration         | all      | exit 0           |
| `pnpm --filter @apps/api test` | API tests + Postgres     | 5.2–5.5  | exit 0           |
| `pnpm run phase-5:gate`        | Phase 5 closure          | 5.6      | BLOCKER — exit 0 |
| `pnpm run guard:architecture`  | import law RULE-038      | 5.6      | exit 0           |
| `pnpm run guard:doc-sync`      | Markdoc when mdoc exists | 5.6      | BLOCKER-P5-006   |

## Environment

| Variable       | Role                                              |
| -------------- | ------------------------------------------------- |
| DATABASE_URL   | Real Postgres for integration                     |
| OUTBOX_ENABLED | Staged outbox rollout P5-4-A10                    |
| STORAGE_DRIVER | `memory` or `prisma` — see create-tour-storage.ts |
