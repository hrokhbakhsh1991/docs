# Phase 5 — Environment matrix

> **Implementation SoT:** [`IMPLEMENTATION-DECISIONS.md`](IMPLEMENTATION-DECISIONS.md) DEC-005, DEC-010  
> **Repo paths:** [`IMPLEMENTATION-MAP.md`](IMPLEMENTATION-MAP.md)  
> **Phase 4 base:** [`../../phase-4/appendices/env-runtime-matrix.md`](../../phase-4/appendices/env-runtime-matrix.md)

```yaml
extends: docs/phase-4/appendices/env-runtime-matrix.md
sql_order:
  - infra/sql/001_tenant_rls.sql
  - infra/sql/002_phase5_data_layer.sql
node: "24.x per .nvmrc"
```

## Variables (Phase 5)

| Variable                  | Required when           | Default dev      | Default prod     | Notes                                                                             |
| ------------------------- | ----------------------- | ---------------- | ---------------- | --------------------------------------------------------------------------------- |
| `DATABASE_URL`            | `STORAGE_DRIVER=prisma` | —                | **required**     | Use `app_tour` role for RLS tests                                                 |
| `STORAGE_DRIVER`          | explicit SoT            | `memory` (unset) | `prisma`         | See [`storage-driver-truth.md`](../../phase-4/appendices/storage-driver-truth.md) |
| `OUTBOX_RELAY_ENABLED`    | 5.4+ behavioral tests   | `false`          | `true` after 5.4 | Starts in-process relay timer                                                     |
| `OUTBOX_POLL_INTERVAL_MS` | relay on                | `1000`           | `1000`           | Legacy used similar interval pattern                                              |
| `NODE_ENV`                | storage default         | `development`    | `production`     |                                                                                   |

**Not used in trunk (legacy only):** `OUTBOX_PROCESSOR_ENABLED` — do not copy Nest env names.

## Required by subphase

| Subphase | Env / infra                                            |
| -------- | ------------------------------------------------------ |
| **5.0**  | `phase-4:gate` green · entry yaml PASS                 |
| **5.1**  | `DATABASE_URL` · apply 001+002 SQL                     |
| **5.2**  | memory OK for unit specs; prisma for integration       |
| **5.3**  | `STORAGE_DRIVER=prisma` for projection + EXPLAIN proof |
| **5.4**  | `OUTBOX_RELAY_ENABLED=true` (or test calls relay once) |
| **5.5**  | same as 5.4                                            |
| **5.6**  | Node 24 · full `phase-5:gate`                          |

## CI recipe (copy-paste)

```bash
nvm use
export STORAGE_DRIVER=prisma
export DATABASE_URL="${DATABASE_URL:-postgresql://app_tour:app_tour@127.0.0.1:5433/app_tour_dev}"
export OUTBOX_RELAY_ENABLED=true
pnpm run phase-4:gate
pnpm --filter @apps/api test
```

## Transaction API

```typescript
// apps/api/src/db/with-canonical-transaction.ts — DEC-002
withCanonicalTransaction(tenantId, (tx) => {
  /* tour + outbox + audit */
});
```

## Forbidden env

```yaml
forbidden:
  - STORAGE_DRIVER=memory for 5.3+ projection proof in CI
  - OUTBOX_RELAY_ENABLED=false in production after 5.4 code merge
  - publishDomainEvent from writeTour when OUTBOX_RELAY_ENABLED=true
```

See [`phase-5-canonical-schema.md`](../../phase-5-canonical-schema.md) §4–7.
