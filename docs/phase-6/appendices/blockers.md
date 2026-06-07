# Phase 6 — Blockers

```yaml
updated: "2026-06-07"
```

| ID                        | Blocks | Condition                    | Status                                                        |
| ------------------------- | ------ | ---------------------------- | ------------------------------------------------------------- |
| **BLOCKER-P6-OUTBOX-5.4** | —      | Cleared 2026-06-07           | Prisma adapters + `denali-finance-outbox.integration.spec.ts` |
| **BLOCKER-P6-GATE-5**     | 6.0    | `phase-5:gate` exit non-zero | none (clear on green gate)                                    |
| **BLOCKER-P6-MINIO-ENV**  | —      | Cleared 2026-06-07           | CI `minio-photo` + local 4/4 PASS                             |

## Resolution commands

```bash
pnpm run phase-5:gate          # clears BLOCKER-P6-GATE-5
pnpm run phase-6:guard         # doc pack only
DATABASE_URL=... pnpm --filter @apps/api exec node --import tsx --test test/denali-finance-outbox.integration.spec.ts
```
