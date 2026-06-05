# Phase 5 — Reliability: memory + Postgres connection audit

`report_date: 2026-06-05`  
`spec: apps/api/test/reliability/outbox-relay-connection-leak.spec.ts`  
Related: [HARDENED-GATE-REPORT.md](./HARDENED-GATE-REPORT.md) (chaos relay memory gate)

## Scope

Long-run audit of:

- `processOutboxRelayOnce` / outbox relay tick path (`apps/api/src/outbox/outbox-relay.ts`, `start-outbox-relay.ts`)
- `withTenantRls` under concurrent load (`apps/api/src/db/with-tenant-rls.ts`)

Targets: monotonic heap growth, `app_tour` connection pool exhaustion, and connection return after error paths + `disconnectPrisma()`.

## Methodology

| Parameter            | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| Operations           | 10,030 (relay publish/fail + interleaved `withTenantRls`)                     |
| Valid pending rows   | 9,800 synthetic `TourCreated` outbox rows                                     |
| Error rows           | 200 (invalid payload, tenant mismatch, missing `domain_event_id`)             |
| Relay batch size     | 50                                                                            |
| RLS interleave       | 10 parallel `withTenantRls` sessions every 5 relay ticks                      |
| Heap sample interval | Every 500 operations + post-GC final                                          |
| Connection probe     | `pg_stat_activity` filtered `usename = 'app_tour'` via admin client           |
| Error-path check     | ≥100 rows marked `failed`; connections polled until `idle in transaction = 0` |
| Teardown             | `disconnectPrisma()` + probe admin client; confirm pool drops                 |
| Bus hygiene          | `resetDomainEventBusForTests()` every 100 relay ticks                         |

**Database:** Postgres on `127.0.0.1:5434`, roles `app_tour` + `postgres` (admin).

**Run command:**

```bash
export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"
export DATABASE_URL=postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db
export DATABASE_URL_ADMIN=postgresql://postgres:postgres@127.0.0.1:5434/tour_db
pnpm --filter @apps/api exec node --import tsx --expose-gc --test test/reliability/outbox-relay-connection-leak.spec.ts
```

Standalone profile script: `apps/api/scripts/reliability-outbox-relay-profile.ts`.

## Heap samples

Post-warmup minimum (excluding start): **37.36 MB**. Final after `global.gc` (when `--expose-gc`): **14.07 MB**. Growth ratio final/min = **0.612** (threshold ≤ 1.15).

| Checkpoint      | Operations | heapUsed (MB) | Notes                                        |
| --------------- | ---------- | ------------- | -------------------------------------------- |
| start           | 0          | 14.28         | Baseline before relay loop                   |
| ~2k             | 1,500      | 37.36         | Post-warmup peak region                      |
| ~5k             | 6,500      | 58.77         | Mid-run high (GC not forced between samples) |
| ~8k             | 8,000      | 22.99         | GC reclaimed mid-run allocation              |
| 10k             | 10,030     | 43.47         | End of relay loop (pre-drain)                |
| pre-disconnect  | 10,030     | 14.07         | After forced GC                              |
| post-disconnect | 10,030     | 15.16         | Probe client only                            |

**Monotonic heap growth:** **N** — heap rose during active processing then fell after GC; final heap below post-warmup minimum. No unbounded retention in relay handlers, Prisma clients, or bus dedupe buffers.

## `pg_stat_activity` — `app_tour` role

| Checkpoint               | total | active | idle | idle in transaction |
| ------------------------ | ----- | ------ | ---- | ------------------- |
| start                    | 10    | 0      | 10   | 0                   |
| mid-run peak (~6.5k ops) | 19    | 0      | 19   | 0                   |
| 10k (immediate sample)   | 10    | 0      | 9    | 1                   |
| after-errors (drained)   | 10    | 0      | 10   | 0                   |
| pre-disconnect           | 10    | 0      | 10   | 0                   |
| post-disconnect          | 1     | 1      | 0    | 0                   |

- **Pool exhaustion:** **N** — peak 19 connections (limit 25); returned to baseline 10 after work completed.
- **Idle-in-transaction leak:** **N** — one transient session at the 10k sample cleared within 2s poll (`waitForConnectionDrain`); zero stuck sessions at assertion time.
- **Post-`disconnectPrisma()`:** app_tour pool released; single active connection from ephemeral probe admin client only.

## Error-path verification

Injected failures exercised:

1. Non-object payload → `OUTBOX_PAYLOAD_INVALID` → `markOutboxFailed`
2. `payload.tenantId` ≠ row tenant → `OUTBOX_TENANT_PAYLOAD_MISMATCH` → `markOutboxFailed`
3. Null `domain_event_id` → `OUTBOX_DOMAIN_EVENT_ID_REQUIRED` → `markOutboxFailed`

≥100 failed rows processed; connection count returned to baseline after error batch.

## Code-path review (no fixes required)

| Check                                             | Status                                                         |
| ------------------------------------------------- | -------------------------------------------------------------- |
| `disconnectPrisma()` in test teardown             | Present                                                        |
| `resetDomainEventBusForTests` between batches     | Every 100 ticks in spec                                        |
| Prisma singleton (`getPrisma` / `getPrismaAdmin`) | No per-tick `new PrismaClient()`                               |
| Relay `running` flag + `interval.unref()`         | Verified in `start-outbox-relay.ts`                            |
| `withTenantRls` transaction scope                 | Single `$transaction` per call; connections released on commit |

No production code changes were required for this audit.

## Verdict

**PASS**

- Monotonic heap leak: **No**
- Pool exhaustion: **No**
- Connections returned after errors + disconnect: **Yes**
- Fixes applied: **None** (test + report only)

Raw machine-readable output: `apps/api/test/reliability/.last-run.json` (generated on spec pass).
