# Phase 4 — Resilience Audit (Saga / Outbox / Graceful Shutdown / Proxy / Schema Drift)

**Date:** 2026-06-05  
**Scope:** `apps/api` transactional outbox, canonical atomic persist, in-process relay, idempotent consumers, **Tour payload schema-version drift (§ Schema drift)**, per-tenant feature flags (mid-burst toggle / race-condition risk), **Rule Engine graceful degradation (§ Rule Engine hard-fail)**, clock skew / time-travel risks (§ Clock skew), SIGTERM/SIGINT graceful shutdown, outbound third-party HTTP proxy seams, and integration specs cited for this pass.  
**Method:** Adversarial chaos synthesis — static code audit + integration spec contract review (graceful-shutdown subprocess spec contract-reviewed; not re-run in this pass).  
**Related:** [`docs/phase-5/subphases/5.4-transactional-outbox.md`](../../../docs/phase-5/subphases/5.4-transactional-outbox.md), [`docs/phase-5/appendices/feature-flag-degradation.md`](../../../docs/phase-5/appendices/feature-flag-degradation.md), [`docs/phase-4/appendices/production-auth-policy.md`](../../../docs/phase-4/appendices/production-auth-policy.md), [`docs/phase-5/appendices/tenant-http-proxy.md`](../../../docs/phase-5/appendices/tenant-http-proxy.md), [`phase3-scalability-stress-audit.md`](./phase3-scalability-stress-audit.md), [`phase5-evolution-audit.md`](./phase5-evolution-audit.md).

---

## Chaos Report — Final Resilience Status

**Verdict:** **CONDITIONAL**  
**Resilience score:** **62 / 100** (single-worker `apps/api`; Postgres + tier-3 gates green; multi-tenant production scale-out blocked on must-fix list)

### Pillar breakdown

| Pillar                      |  Score | Rationale                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Transactional integrity** | **78** | Canonical tour + audit + outbox co-commit proven (F-06…F-09); idempotent consumers absorb at-least-once. Gaps: publish≠`done` pairing (F-02), SIGKILL orphan class (F-10 / OZ-A).                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Degradation**             | **58** | Pool → 503 and per-tenant 429 are graceful ([phase3](./phase3-scalability-stress-audit.md) pool + limiter gates). Fail-open gaps: noisy-neighbor CPU/pool ([NN-01](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register), [NN-02](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register)), Redis fail-closed **500** ([SCAL-HF-11](phase3-scalability-stress-audit.md#hard-fail-risks)), latent proxy hang ([PI-01](#proxy-isolation--outbound-third-party-calls)). Feature-flag degradation **pass** (FF-F-05). Schema drift → structured 4xx, not 500 ([SV-CRIT-01](#critical-failure-definition-this-pass)). |
| **Recovery**                | **52** | Backlog + idempotent replay **pass** (BL-01, F-16). No stale-`processing` reclaim (F-01), terminal `failed` (F-03), projection partial success without auto-heal (F-04). SIGTERM drain partial — 7 shutdown gaps (SD-G1…G7).                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Config consistency**      | **64** | Mid-load theme/workspace sync proven (PU-03 harness); feature-flag flip without restart (FF-F-05). 5s registry TTL window (PU-03); split cache vs uncached flag reads (PU-F-02 / FF-F-02). E2E hot-reload **not** atomic (`atomic_update_paths_e2e=no`).                                                                                                                                                                                                                                                                                                                                                                                               |
| **External dependencies**   | **55** | Postgres paths well-bounded; proxy not on prod path today (PI-03). When wired, PI-01 is systemic. Admin-pool amplification on rate-limited routes ([SCAL-HF-01](phase3-scalability-stress-audit.md#hard-fail-risks)) is an external-DB coupling risk.                                                                                                                                                                                                                                                                                                                                                                                                  |

### Phase 3 hard-fail cross-links (brief)

| Phase 3 ID                                                                                                                                           | Phase 4 interaction                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [SCAL-HF-01](phase3-scalability-stress-audit.md#hard-fail-risks) / [RL-DOS-01](phase3-scalability-stress-audit.md#dos-vulnerability-table)           | Admin `findUnique` storm on rate-limited routes amplifies before outbox work — can mask relay recovery under load.                                                |
| [SCAL-HF-10](phase3-scalability-stress-audit.md#hard-fail-risks) / [NN-01](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register) | RuleEngine CPU on Tenant A stalls Tenant B reads **and** deepens validation queues on the shared event loop ([§ Bulk import](#bulk-import--ruleengine-coupling)). |
| [SCAL-HF-11](phase3-scalability-stress-audit.md#hard-fail-risks)                                                                                     | Redis blip → **500** on all limited routes — worse degradation than pool **503**.                                                                                 |
| [FOF-LOG-01…03](phase3-scalability-stress-audit.md#115-fatal-observability-flaw-inventory)                                                           | Coupled with SD-G5 — incident response blind during cascade; SIGTERM may drop log tail.                                                                           |
| [SCAL-HF-04](phase3-scalability-stress-audit.md#hard-fail-risks)                                                                                     | Unbounded validation queue + bulk persist bypasses HTTP limits ([BULK-01](#bulk-import--ruleengine-coupling)) — OOM path independent of outbox health.            |

### Must-fix (blocks multi-tenant production resilience)

| ID                         | Finding                                  | Why cascade                                                          |
| -------------------------- | ---------------------------------------- | -------------------------------------------------------------------- |
| **F-01**                   | Stale `processing` reclaim               | OZ-01/02/06 — deploy + crash leaves permanent undelivered events     |
| **F-05**                   | Shutdown flush ignores `processing`      | SD-G1 — rolling restart **creates** zombies during normal ops        |
| **F-02**                   | Bus publish ≠ `done` update              | Amplifies F-01; consumers heal, outbox does not                      |
| **PI-01**                  | Unbounded proxy `fetch`                  | When map routes wire in — hung upstream holds slots until OS timeout |
| **NN-01 / NN-02** (phase3) | Noisy-neighbor CPU + pool                | Innocent tenant outage under one import tenant                       |
| **RL-DOS-01** (phase3)     | Uncached admin read per rate-limit check | Cross-tenant admin pool DoS                                          |
| **SCAL-HF-11** (phase3)    | Redis fail-closed 500                    | Total write-path failure on infra blip                               |
| **PU-F-01**                | No write-path cache invalidation         | PU-03/PU-06 — config API stale up to 5s while writes see new flags   |

### Accepted (documented; manual ops or Phase 5+)

| ID                    | Finding                                      | Acceptance basis                                                     |
| --------------------- | -------------------------------------------- | -------------------------------------------------------------------- |
| **F-03**              | Terminal `failed` outbox                     | Poison payloads (INT-SAGA-03); admin replay tooling deferred         |
| **F-04**              | Projection partial success (OZ-D)            | DEC-008 — metrics + manual reconciliation                            |
| **F-10**              | SIGKILL mid canonical TX                     | Postgres best-effort; chaos-monitored OZ-A                           |
| **F-15 / BL-01**      | No per-tenant FIFO in prod relay             | Idempotent handlers; order-sensitive projections need app sequencing |
| **SD-G4…G7**          | Shutdown watchdog / log drain / worker drift | Low severity; SD-G4 latent until hung-handler incident               |
| **PI-03**             | Proxy not on `main.ts`                       | Exposure deferred until DI-PROXY-01 wiring                           |
| **PU-03**             | 5s registry TTL                              | Performance trade-off; test harness resets cache explicitly          |
| **CLK-F-01…04**       | Mixed app/DB timestamps                      | Forensic timeline skew; JWT path **pass** (CLK-SKEW-04…07)           |
| **SV-F-03 / SV-F-04** | PATCH drift untested; no `migrateCanonical`  | Phase 6 scope; POST paths proven graceful                            |

### Top 3 total cascading failure scenarios

#### CASCADE-01 — Bulk import noisy-neighbor platform brownout

| Stage           | Narrative                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**     | Tenant A runs sustained bulk write (`POST /tours` at 50 RPS or `persistNewTourAtomically` at 10 parallel/chunk — [BULK-01](#bulk-import--ruleengine-coupling)).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Propagation** | Sync RuleEngine validation monopolizes the event loop ([NN-01](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register)) → Tenant B `GET /health`, tenant-config, and `GET /tours/:id` latency spikes → concurrent canonical TX from A exhausts `getPrisma()` pool ([NN-02](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register)) → B receives **503** `DB_POOL_SATURATED` → outbox `pending` backlog grows → relay competes for admin pool ([NN-06](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register)) → logging on `finish` amplifies ([FOF-LOG-02](phase3-scalability-stress-audit.md#hard-fail-risks)). |
| **User impact** | Innocent tenants experience login/read timeouts and **503** storms; writes may still succeed for A while B appears down — **cross-tenant availability collapse** without data leak (RLS holds).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |

#### CASCADE-02 — Deploy storm processing zombies (silent projection drift)

| Stage           | Narrative                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**     | Rolling deploy sends **SIGTERM** during active `processOutboxRelayOnce` tick; some pods **SIGKILL** on grace expiry ([SD-G2](#graceful-shutdown-audit), OZ-01/OZ-02).                                                                                                                                                                                                                        |
| **Propagation** | Rows stuck in `processing` (F-01) → new pods claim only `pending` → `flushOutboxRelay` counts `pending` only and may **exit 0** with zombies ([SD-G1](#graceful-shutdown-audit), SD-G3) → API continues returning **201** for new tours → outbox never reaches `done` for affected events → projections/search lag indefinitely → ops see healthy pods but growing `processing` count in DB. |
| **User impact** | Tours **appear** created in API; downstream consumers never catch up — **silent multi-hour data-plane divergence** until manual SQL or reclaim job.                                                                                                                                                                                                                                          |

#### CASCADE-03 — Rate-limiter identity flood + Redis blip (total write failure)

| Stage           | Narrative                                                                                                                                                                                                                                                                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Trigger**     | Attacker or misconfigured client sends **100+ unique `x-tenant-id` values** on rate-limited routes ([SCAL-HF-01](phase3-scalability-stress-audit.md#hard-fail-risks), RL-DOS-01); coincident **Redis** connectivity blip ([SCAL-HF-11](phase3-scalability-stress-audit.md#hard-fail-risks)).                                                                                  |
| **Propagation** | Each request issues uncached `getPrismaAdmin().tenant.findUnique` → admin pool saturated → legitimate tenant resolution tails spike → Redis store throws → middleware fail-closed **500** on **all** rate-limited routes (not 429) → retries amplify admin load → outbox relay starved for admin connections → health checks may pass while mutation API is entirely **500**. |
| **User impact** | **Platform-wide write outage** for all tenants; reads may partially work — operators see Redis/DB errors without per-tenant isolation of failure.                                                                                                                                                                                                                             |

### Parent handoff (chaos capstone)

`resilience_score=62` · `verdict=CONDITIONAL` · `zombie_risk_count=6` · `shutdown_gap_count=7` · `hard_fail_count=16` · `degradation_path_count=2` · `cascade_scenarios=CASCADE-01,CASCADE-02,CASCADE-03` · `file=apps/api/docs/phase4-resilience-audit.md`

---

## Executive summary

| Dimension                                                        | Verdict                                                                                                                                                                                               |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Canonical TX (tour + audit + outbox enqueue)**                 | **Pass** — single `withCanonicalTransaction`; abort mid-TX rolls back together                                                                                                                        |
| **Relay pending → bus → done**                                   | **Pass** when process healthy; SKIP LOCKED + idempotent consumers                                                                                                                                     |
| **Crash between relay states (`processing` / publish / `done`)** | **Partial** — at-least-once delivery safe; **no stale-`processing` reclaim**                                                                                                                          |
| **Saga partial success (projection after outbox `done`)**        | **Partial** — metrics + logs; **no auto-heal** (DEC-008)                                                                                                                                              |
| **Zombie-risk scenarios (adversarial)**                          | **6** (see [Zombie event definition](#zombie-event-definition))                                                                                                                                       |
| **`main.ts` shutdown static parity**                             | **Pass** — `installGracefulShutdownHandlers` delegates to shared module                                                                                                                               |
| **SIGTERM graceful shutdown (runtime)**                          | **Partial** — drain + pending flush proven; **7** contract gaps (see [Graceful shutdown audit](#graceful-shutdown-audit))                                                                             |
| **Orphaned committed TX on SIGTERM mid-request**                 | **No** — `server.close` drains handlers; integration spec asserts zero orphan tour/audit/outbox                                                                                                       |
| **Consumer down 1h → resume (backlog replay)**                   | **Pass** idempotent dedupe; **Partial** FIFO per tenant in production relay                                                                                                                           |
| **Data Integrity Breach (duplicate replay)**                     | **0** on `subscribeIdempotentDomainEvent` + `processed_domain_events`                                                                                                                                 |
| **FIFO per tenant (production relay)**                           | **No** — see [Consumer down 1h](#consumer-down-1h--backlog-replay-and-ordering)                                                                                                                       |
| **Schema drift — Tour payload version mismatch (HTTP write)**    | **Pass** — structured `400` / default-fill `201`; **0** proven `500` on version drift                                                                                                                 |
| **Schema drift — PATCH / Phase 6 migration**                     | **Partial** — PATCH parity by code; no PATCH drift spec; `migrateCanonical` not wired                                                                                                                 |
| **Partial tenant-config update (hot-reload)**                    | **6** risks — [§ Partial update](#hot-reload-tenant-config--partial-update-audit); DB writes **yes**, E2E coherence **no**                                                                            |
| **Rule Engine graceful degradation**                             | **Partial** — proactive **basic** variant (DEC-014); **no** runtime fallback when advanced engine init/validate fails — [§ Rule Engine hard-fail](#graceful-degradation-audit--rule-engine-hard-fail) |
| **Chaos capstone (this pass)**                                   | **CONDITIONAL** — resilience **62/100** — [Chaos Report](#chaos-report--final-resilience-status)                                                                                                      |

**Parent handoff:** `resilience_score=62` · `verdict=CONDITIONAL` · `zombie_risk_count=6` · `partial_update_risk_count=6` · `atomic_update_paths_db=yes` · `atomic_update_paths_e2e=no` · `shutdown_gap_count=7` · `data_integrity_breach_count=0` · `fifo_guaranteed_per_tenant=no` · `schema_drift_critical_failure_count=0` · `schema_drift_graceful_paths_count=14` · `hard_fail_count=16` · `degradation_path_count=2` · `orphaned_tx_risk=no` (SIGTERM; **yes** SIGKILL — [Mid-request kill analysis](#mid-request-kill-analysis)) · `recovery=partial` · `cascade_scenarios=CASCADE-01,CASCADE-02,CASCADE-03` · `file=apps/api/docs/phase4-resilience-audit.md`

---

## Architecture under audit

```mermaid
sequenceDiagram
  participant API as persistNewTourAtomically
  participant CTX as withCanonicalTransaction
  participant DB as Postgres
  participant Relay as processOutboxRelayOnce
  participant Bus as publishDomainEvent
  participant Sub as subscribeIdempotentDomainEvent

  API->>CTX: tour + audit + enqueueOutboxEvent
  CTX->>DB: COMMIT (pending outbox)
  Note over Relay,DB: Separate connection / process — not same TX as bus
  Relay->>DB: claim pending → processing (admin TX)
  Relay->>Bus: publish (no DB TX)
  Relay->>DB: status = done | failed
  Bus->>Sub: handler
  Sub->>DB: processed_domain_events claim
```

| Artifact                                                                                       | Role                                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`atomic-canonical-tour-persist.ts`](../src/canonical/atomic-canonical-tour-persist.ts)        | RULE-008 saga step 1: tour + audit + outbox in one TX                   |
| [`with-canonical-transaction.ts`](../src/db/with-canonical-transaction.ts)                     | RLS session + Prisma `$transaction` boundary                            |
| [`enqueue-domain-event.ts`](../src/outbox/enqueue-domain-event.ts)                             | DEC-004 outbox insert; `pending`; UNIQUE `(tenant_id, domain_event_id)` |
| [`outbox-relay.ts`](../src/outbox/outbox-relay.ts)                                             | `pending` → `processing` → publish → `done` \| `failed`                 |
| [`idempotent-domain-event-subscriber.ts`](../src/events/idempotent-domain-event-subscriber.ts) | Bus-side idempotency + projection inconsistency signals                 |
| [`start-outbox-relay.ts`](../src/outbox/start-outbox-relay.ts)                                 | Poll loop; overlap guard (`running` flag)                               |
| [`graceful-shutdown.ts`](../src/server/graceful-shutdown.ts)                                   | Stop relay; flush **pending** only                                      |

**Important boundary:** “DB-to-message-bus” is **not** one database transaction. The message bus publish runs **after** the canonical TX commits and **outside** `withTenantRls` (see relay comment in `publishClaimedOutboxRow`). Mid-**canonical**-TX failure is Postgres rollback; mid-**relay** failure is outbox state + at-least-once bus semantics.

---

## Graceful shutdown audit

### Signal wiring (`main.ts` → shared module)

Production entrypoint registers shutdown on both signals and delegates to one implementation:

```33:33:apps/api/src/main.ts
installGracefulShutdownHandlers({ server, outboxRelay });
```

| Artifact                                                                           | Role                                                                                                           |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [`main.ts`](../src/main.ts)                                                        | HTTP `createServer`, `startOutboxRelayIfEnabled()`, `installGracefulShutdownHandlers({ server, outboxRelay })` |
| [`graceful-shutdown.ts`](../src/server/graceful-shutdown.ts)                       | `runGracefulShutdown` sequence + `SIGTERM` / `SIGINT` handlers → `process.exit(0\|1)`                          |
| [`graceful-shutdown.spec.ts`](../test/4-integration/graceful-shutdown.spec.ts)     | Static `auditMainTsShutdownContract()` + subprocess SIGTERM under 50× `POST /tours`                            |
| [`graceful-shutdown-worker.ts`](../test/4-integration/graceful-shutdown-worker.ts) | Test-only subprocess mirror; emits `GRACEFUL_SHUTDOWN_READY` for port discovery                                |

**Static parity (`auditMainTsShutdownContract`):** With `main.ts` importing `installGracefulShutdownHandlers`, the spec expects **zero** static gaps (`server.close`, `processOutboxRelayOnce` flush loop, `disconnectPrisma`, `SIGTERM` in `graceful-shutdown.ts`). Override: `GRACEFUL_SHUTDOWN_SKIP_MAIN_GAP=1` skips the static test; `GRACEFUL_SHUTDOWN_USE_MAIN=1` runs the runtime test against `main.ts` instead of the worker.

### Shutdown contract — intended vs implemented

| Step | Intended (P0 contract)                                      | Implemented (`runGracefulShutdown`)                                                                                                     | Test evidence                                                         |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 1    | Stop accepting **new** HTTP connections                     | `outboxRelay.stop()` then `server.close(callback)`                                                                                      | Worker + module; Node stops new accepts, waits for in-flight requests |
| 2    | Stop background outbox poll                                 | `clearInterval` via `OutboxRelayHandle.stop()`                                                                                          | `start-outbox-relay.ts`                                               |
| 3    | Drain in-flight HTTP (canonical TX completes or rolls back) | Implicit via `server.close` — no explicit request tracker                                                                               | `graceful-shutdown.spec.ts` — 50 concurrent POSTs must settle         |
| 4    | Flush **committed** `pending` outbox before exit            | `flushOutboxRelay()` — loop `processOutboxRelayOnce` until admin `pending` count = 0 or `GRACEFUL_SHUTDOWN_FLUSH_MS` (default **8000**) | Runtime spec + `assertToursHaveAuditAndFlushedOutbox`                 |
| 5    | Release Prisma pools                                        | `disconnectPrisma()` when `DATABASE_URL` set                                                                                            | Static audit + runtime exit 0                                         |
| 6    | Process exit                                                | Handler `.then(() => process.exit(0))`                                                                                                  | Subprocess `exitCode === 0`                                           |

```mermaid
sequenceDiagram
  participant OS as SIGTERM_SIGINT
  participant H as installGracefulShutdownHandlers
  participant G as runGracefulShutdown
  participant Relay as outboxRelay.stop
  participant HTTP as server.close
  participant Flush as flushOutboxRelay
  participant DB as disconnectPrisma

  OS->>H: signal
  H->>G: runGracefulShutdown (once)
  G->>Relay: clearInterval
  Note over Relay: In-flight processOutboxRelayOnce may still run
  G->>HTTP: stop accept, drain in-flight handlers
  HTTP-->>G: all connections idle
  G->>Flush: pending count loop (deadline)
  G->>DB: $disconnect app + admin clients
  G-->>H: resolve
  H->>OS: process.exit(0)
```

**Ordering note:** Relay timer is stopped **before** HTTP drain so new relay ticks do not start during shutdown; HTTP handlers may still enqueue `pending` rows until `server.close` completes, then flush drains them (matches integration test design).

### Mid-request kill analysis

| Kill mode                        | Orphaned **committed** tour without audit/outbox?                               | Open DB TX on wire?                                                                                                | Open Prisma pool connections?                   | Partial outbox?                                                                          |
| -------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **SIGTERM** (graceful contract)  | **No** — proven for concurrent create-tour load                                 | In-flight handler runs to completion or error; uncommitted `withCanonicalTransaction` rolls back on connection end | Closed by `disconnectPrisma` after drain        | `pending` drained when flush succeeds; **`processing` may remain** (SD-G1, OZ-06)        |
| **SIGKILL / OOM** (non-graceful) | **Risk yes** (OZ-A) — Postgres aborts open sessions; chaos audit is best-effort | Server-side TX aborted when backend connection drops                                                               | OS reclaims process; pool not gracefully closed | Relay may stop mid-claim or mid-publish → `processing` or bus-ahead-of-DB (OZ-01, OZ-02) |

**Orphaned TX (parent):** **`orphaned_tx_risk=no`** for the **SIGTERM** shutdown path under test (no partial canonical commit survives). **`yes`** for **SIGKILL** mid-open-`$transaction` (same class as **TX-04** / OZ-A).

Canonical mid-request behavior: `withCanonicalTransaction` wraps tour + audit + outbox enqueue in one Prisma `$transaction`. Throw or connection loss before commit → full rollback (see [Recovery flows §2](#2-canonical-tx-failure-rollback)). `server.close` does not cut off active handlers abruptly; SIGTERM during `POST /tours` allows commits that finish before close, then flush publishes their `pending` rows.

### Shutdown contract gaps (count = 7)

Operational gaps distinct from static `main.ts` parity (which is **pass**).

| ID        | Severity | Gap                                                                                                                                                             | Exists today                                                                                  | Links                |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | -------------------- |
| **SD-G1** | High     | Flush loop counts only `status = 'pending'` — rows in **`processing`** not drained or reset                                                                     | `flushOutboxRelay` admin count predicate                                                      | OZ-06, F-05          |
| **SD-G2** | Medium   | `outboxRelay.stop()` does not **await** an in-flight `processOutboxRelayOnce` tick (`running` flag in `start-outbox-relay.ts`)                                  | Timer cleared; tick may still publish or leave `processing`                                   | OZ-01, OZ-02         |
| **SD-G3** | Medium   | Flush **deadline expiry** exits without error — process can exit 0 with `pending > 0`                                                                           | No log/metric/non-zero exit when `GRACEFUL_SHUTDOWN_FLUSH_MS` exhausted                       | Extends F-05         |
| **SD-G4** | Medium   | No **global shutdown timeout** — hung handler blocks `server.close` indefinitely                                                                                | No `unref` watchdog or forced close                                                           | —                    |
| **SD-G5** | Low      | No **logger / observability drain** after HTTP close                                                                                                            | [`phase3-scalability-stress-audit.md`](./phase3-scalability-stress-audit.md) LOG-BP-HARDEN-02 | FOF-LOG-03 tail loss |
| **SD-G6** | Low      | Test **worker duplicates** shutdown logic instead of importing `runGracefulShutdown` — drift risk (worker always flushes; module gates flush on `DATABASE_URL`) | `graceful-shutdown-worker.ts` inline `gracefulShutdown()`                                     | Maintenance          |
| **SD-G7** | Low      | Worker registers **SIGTERM only**; production also handles **SIGINT**                                                                                           | Worker vs `installGracefulShutdownHandlers`                                                   | Dev Ctrl+C parity    |

**`shutdown_gap_count=7`** (SD-G1 … SD-G7). Static `main.ts` handler gaps: **0** when shared module is wired.

### Phase 4 integration cross-links

Shutdown interacts with other Phase 4 integration themes as follows:

| Theme              | Spec                                                                                                                                                                             | Shutdown interaction                                                                                                                                                                                                                                         |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Saga / outbox**  | [`saga-rollback.spec.ts`](../test/4-integration/saga-rollback.spec.ts), [`event-backlog-recovery.spec.ts`](../test/4-integration/event-backlog-recovery.spec.ts)                 | Shutdown flush replays `processOutboxRelayOnce` (same tick as relay); does not fix `done`/`failed`/`processing` stuck states (INT-SAGA-01/03, OZ-06)                                                                                                         |
| **Schema version** | [`schema-version-compat.spec.ts`](../test/4-integration/schema-version-compat.spec.ts)                                                                                           | Uses ad-hoc `server.close` in tests only — **no** production schema gate on shutdown; in-flight **400** `SCHEMA_VERSION_MISMATCH` / `VALIDATION_FAILURE` responses complete during drain; see [§ Schema drift](#schema-drift--tour-payload-version-mismatch) |
| **Clock skew**     | [`clock-skew-resilience.spec.ts`](../test/4-integration/clock-skew-resilience.spec.ts)                                                                                           | JWT/expiry checks are per-request; shutdown does not advance clocks or invalidate tokens                                                                                                                                                                     |
| **Proxy tenant**   | [`proxy-tenant-isolation.spec.ts`](../test/4-integration/proxy-tenant-isolation.spec.ts)                                                                                         | Proxy subprocess uses its own `server.close` — **separate process** from API `main.ts`; no shared shutdown coordinator                                                                                                                                       |
| **Feature flags**  | [`feature-flag-degradation.spec.ts`](../test/4-integration/feature-flag-degradation.spec.ts), [`dynamic-config-sync.spec.ts`](../test/4-integration/dynamic-config-sync.spec.ts) | Mid-load DB flip proven **sequentially**; **no** request-scoped config snapshot; registry cache vs uncached flag reads (FF-RC-02 … FF-RC-03)                                                                                                                 |

### Prove commands (graceful shutdown)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma OUTBOX_RELAY_ENABLED=true

# Default: worker subprocess + main.ts static audit
pnpm --filter @apps/api exec node --import tsx --test test/4-integration/graceful-shutdown.spec.ts

# Optional: runtime against production entrypoint
GRACEFUL_SHUTDOWN_USE_MAIN=1 pnpm --filter @apps/api exec node --import tsx --test test/4-integration/graceful-shutdown.spec.ts
```

Assertions (runtime case): `assertZeroOrphanedState`, `auditTenantConsistency`, committed tours have audit + `TourCreated` outbox, **zero** pending outbox for committed tours, subprocess **exit 0**.

---

## Feature flags — race-condition risk (mid-burst toggle)

**Assumption (adversarial):** Operator updates `tenants.theme` (or static registry in dev) **during** a high-load burst (`Promise.all` concurrent `POST /tours` or mixed read/write). There is **no versioned or snapshot config bound per HTTP request** — each code path re-reads theme JSON at its own `await` boundary.

### Flag sources (inventory)

| #   | Source                                                            | Key / variable                                                                                                             | Read path                                                                                                                  | Cached?                                               |
| --- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| 1   | Postgres `tenants.theme` (JSONB)                                  | `featureFlags.advancedRuleEngine`                                                                                          | [`resolveTenantFeatureFlags`](../src/tenant/resolve-tenant-feature-flags.ts) → `validationVariant` on `POST`/`PATCH` tours | **No** — admin `findUnique` every call                |
| 2   | Postgres `tenants.theme`                                          | `rateLimitRps` (root)                                                                                                      | [`parseRateLimitRpsFromTheme`](../src/middleware/tenant-rate-limiter.ts) in `resolveEffectiveRateLimitForTenant`           | **No**                                                |
| 3   | Postgres `tenants.theme`                                          | `featureFlags.rateLimitRps`                                                                                                | Same (nested; root wins precedence)                                                                                        | **No**                                                |
| 4   | Static `DEV_TENANTS`                                              | `theme.featureFlags.*`                                                                                                     | Same resolvers when [`isStaticTenantRegistryAllowed()`](../src/tenant/tenant-registry.ts)                                  | N/A (in-memory)                                       |
| 5   | Code default                                                      | `ADVANCED_RULE_ENGINE_DEFAULT = true`                                                                                      | Unknown tenant / non-UUID / missing row                                                                                    | N/A                                                   |
| 6   | Env                                                               | `TENANT_RATE_LIMIT_ENABLED`, `TENANT_RATE_LIMIT_POINTS`, `TENANT_RATE_LIMIT_READ_POINTS`, `TENANT_RATE_LIMIT_DURATION_SEC` | Global bucket defaults in `resolveTenantRateLimitConfig`                                                                   | Process env (static per boot)                         |
| 7   | Env                                                               | `DATABASE_URL` unset vs set                                                                                                | Switches static registry vs Postgres for flags + rate theme                                                                | Boot-time                                             |
| 8   | Env                                                               | `NODE_ENV` + production auth mode                                                                                          | Gates static registry (`isStaticTenantRegistryAllowed`)                                                                    | Boot-time                                             |
| 9   | Env                                                               | `P5_VALIDATION_ENGINE_CACHE_SIZE`                                                                                          | RuleEngine LRU size only — **not** flag values                                                                             | Process-global Map                                    |
| 10  | [`tenant-registry-cache`](../src/tenant/tenant-registry-cache.ts) | Full tenant row (5s TTL)                                                                                                   | `resolveRegisteredTenantById` / subdomain — **workspace + stripped theme**                                                 | **Yes** — **not** used by `resolveTenantFeatureFlags` |

**Not a feature-flag source:** [`STORAGE_DRIVER`](../src/storage/create-tour-storage.ts) (`memory` \| `prisma`) — persistence backend only; no flag reads on storage hot path. **Validation gate** ([`pre-transaction-validation.ts`](../src/canonical/pre-transaction-validation.ts)) receives `validationVariant` from caller; it does not re-resolve flags mid-gate.

### Hot-path read order (`POST /tours`)

```mermaid
sequenceDiagram
  participant R as tours.routes
  participant Bind as runWithHttpRequestContext
  participant RL as consumeTenantRateLimit
  participant TS as ToursService
  participant WS as resolveWorkspaceTypeForTenant
  participant FF as resolveTenantFeatureFlags
  participant Val as runPreTransactionValidation

  R->>Bind: rateLimit write
  Bind->>RL: resolveEffectiveRateLimitForTenant (admin findUnique theme)
  Bind->>TS: createTour
  TS->>WS: resolveRegisteredTenantById (registry cache 5s)
  TS->>FF: resolveTenantFeatureFlags (uncached admin findUnique)
  TS->>Val: validationVariant fixed for this call
```

| Stage                  | Resolver                                         | Snapshot per request?                                                            |
| ---------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------- |
| Rate limit (HTTP bind) | `resolveEffectiveRateLimitForTenant`             | **No** — independent DB read                                                     |
| Workspace type         | `resolveWorkspaceTypeForTenant` → registry cache | **No** — may be stale vs DB up to 5s                                             |
| Validation variant     | `resolveTenantFeatureFlags`                      | **No** — fresh admin read; captured once in `ToursService` before canonical path |
| Tenant config API      | `resolveRegisteredTenantById` + `themeFromJson`  | **No** — cache + **strips** `featureFlags` from JSON response                    |

### Race-condition risk definition

A **race-condition risk** here means: without a **request-scoped config version / snapshot**, concurrent requests or sequential awaits in one request can observe **different generations** of tenant theme JSON after a mid-burst toggle.

**`race_condition_risk_count=7`** — matrix rows **FF-RC-01 … FF-RC-07** below.

### Scenario matrix (mid-burst toggle)

| ID           | Adversarial condition                                                                                          | Request A vs B (or same request)                                                               | Severity                                                                                 | Auto mitigation today                                             | Test evidence                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **FF-RC-01** | Admin sets `advancedRuleEngine: false` mid concurrent `POST /tours` burst                                      | **A** still sees `true` → 400; **B** sees `false` → 201 on same invalid body                   | **High** (expected gradual rollout; violates strict cross-request uniformity)            | None — by design per-request read                                 | `feature-flag-degradation.spec.ts` burst + flip tenant; **not** parallel at flip instant |
| **FF-RC-02** | Toggle between `resolveWorkspaceTypeForTenant` (cached) and `resolveTenantFeatureFlags` (uncached) on one POST | Workspace from cache generation N, variant from DB generation N+1                              | **Medium**                                                                               | None                                                              | Inferred; dual admin/registry reads in `tours.service.ts`                                |
| **FF-RC-03** | DB update without cache invalidation                                                                           | `GET /api/v2/tenant-config` stale theme up to **5s**; `POST /tours` sees new flags immediately | **Medium**                                                                               | Tests call `resetTenantRegistryCacheForTests()` after admin write | `dynamic-config-sync.spec.ts` (explicit cache reset at flip)                             |
| **FF-RC-04** | Theme `rateLimitRps` toggled between rate-limit consume and tour handler                                       | Same request: different effective RPS vs validation variant                                    | **Low**                                                                                  | Narrow window; two uncached reads                                 | Inferred from `bind-request-context.ts` + `tours.service.ts`                             |
| **FF-RC-05** | Rate limit theme read bypasses registry cache; tenant-config uses cache                                        | Neighbor latency + **inconsistent** limit vs displayed config under load                       | **Medium**                                                                               | None                                                              | Phase 3 **RL-DOS-01** / NN-03 cross-link                                                 |
| **FF-RC-06** | `DATABASE_URL` unset in dev — static `DEV_TENANTS` vs Postgres row diverge                                     | Flags from static theme (no `featureFlags` key → default advanced) vs DB                       | **High** (dev/test only); **Pass** in production (`isStaticTenantRegistryAllowed` false) | Production requires DB                                            | `tenant-registry.ts`, `production-auth-policy.md`                                        |
| **FF-RC-07** | Concurrent overlap at exact flip instant                                                                       | Simultaneous A/B split-brain on validation outcome                                             | **Medium**                                                                               | Per-request variant pinned before TX; no cross-request lock       | Flip test is **sequential** loop, not `Promise.all` at flip                              |

**Single-request consistency (partial pass):** After `ToursService` resolves flags once, `validationVariant` is passed through `CanonicalTourService.writeTour` → `runPreTransactionValidation` → optional `withCanonicalTransaction` without a second flag read. Queued validation ([`validation-scheduler.ts`](../src/canonical/validation-scheduler.ts)) does not re-fetch theme.

### Integration with other Phase 4 themes

| Theme                 | Interaction                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Saga / outbox**     | Flag flip does not roll back in-flight canonical TX; committed tours retain validation outcome from variant at request entry           |
| **Graceful shutdown** | In-flight POSTs keep variant resolved before signal; shutdown does not re-read flags                                                   |
| **Proxy / outbound**  | No flag reads on proxy path                                                                                                            |
| **Backlog / relay**   | Unaffected — outbox payload does not embed `validationVariant`                                                                         |
| **Phase 3 caches**    | RuleEngine LRU keyed by `tenant:workspace:variant` — both variants may coexist during flip window (benign); see phase3 cache inventory |

### Feature-flag findings

| ID      | Severity | Finding                                                                                               | Gap / recommendation                                                                   |
| ------- | -------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| FF-F-01 | High     | **No request-scoped config snapshot** — concurrent requests see different flag generations (FF-RC-01) | Document ops expectation; optional `themeVersion` / bind flags in ALS at HTTP boundary |
| FF-F-02 | Medium   | **Split cache policy** — registry 5s TTL vs uncached flag + rate reads (FF-RC-02, FF-RC-03, FF-RC-05) | Route flag + RPS through registry cache with explicit invalidation on admin write      |
| FF-F-03 | Medium   | **tenant-config omits `featureFlags`** in `themeFromJson`                                             | UI cannot observe live flag via config API; extend mapping or dedicated flags endpoint |
| FF-F-04 | Low      | **Flip-at-instant concurrency** not in test contract (FF-RC-07)                                       | Add adversarial `Promise.all` straddling admin `update`                                |
| FF-F-05 | Pass     | **Per-tenant degradation** without global 503                                                         | DEC-014; burst specs green                                                             |
| FF-F-06 | Pass     | **Variant pinned through validation gate + canonical TX** for one `createTour` call                   | No mid-TX re-resolve                                                                   |

### Prove commands (feature flags)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma NODE_ENV=test

node --import tsx --test \
  test/4-integration/feature-flag-degradation.spec.ts \
  test/4-integration/dynamic-config-sync.spec.ts
```

**Cross-link:** Hard-fail vs degradation path inventory (engine service failure, no reactive `basic` fallback) — [§ Rule Engine hard-fail](#graceful-degradation-audit--rule-engine-hard-fail).

---

## Graceful degradation audit — Rule Engine hard-fail

**Date:** 2026-06-05  
**Question:** When the Advanced Rule Engine or `PlatformWizardEngine` fails at runtime, does the API fall back to **Basic Validation** (`variant: basic`), or does the **whole write hard-fail**?

**Verdict:** **Whole request hard-fails** on engine/validation failure. **No** reactive downgrade from `default` → `basic` when `validateCanonical` or `tryInit` fails. **Degradation exists only proactively** via `tenants.theme.featureFlags.advancedRuleEngine: false` (DEC-014), resolved once per `createTour` / `updateTour` before validation runs.

**Parent counts (this section):** `hard_fail_count=16` · `degradation_path_count=2`

### Call-site inventory (production hot path)

| #   | Layer             | File                                                                                                | Symbol / line                            | Role                                                                          |
| --- | ----------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | Route service     | [`tours.service.ts`](../src/tours/tours.service.ts)                                                 | `createTour` 26–27, `updateTour` 51–52   | `resolveTenantFeatureFlags` → `validationVariantForFeatureFlags`              |
| 2   | Canonical write   | [`canonical-tour.service.ts`](../src/canonical/canonical-tour.service.ts)                           | `writeTour` 75–80, `updateTour` 180–185  | `runPreTransactionValidation` (RULE-003)                                      |
| 3   | Pre-TX gate       | [`pre-transaction-validation.ts`](../src/canonical/pre-transaction-validation.ts)                   | `runPreTransactionValidation` 26–45      | Scheduler → sync `validateCanonicalBeforePersist`; per-tenant gate on success |
| 4   | Validation facade | [`canonical-validation.ts`](../src/tours/canonical-validation.ts)                                   | `validateCanonicalBeforePersist` 95–139  | `getOrCreateValidationEngine` → `engine.validateCanonical`                    |
| 5   | Engine cache      | [`canonical-validation.ts`](../src/tours/canonical-validation.ts)                                   | `getOrCreateValidationEngine` 67–78      | `PlatformWizardEngine.create(plugin)` on LRU miss                             |
| 6   | TX gate consume   | [`with-canonical-transaction.ts`](../src/db/with-canonical-transaction.ts)                          | `consumePreTransactionValidationGate` 23 | Refuses TX without prior validation                                           |
| 7   | Feature flags     | [`resolve-tenant-feature-flags.ts`](../src/tenant/resolve-tenant-feature-flags.ts)                  | `validationVariantForFeatureFlags` 34–37 | `advancedRuleEngine: false` → `"basic"`                                       |
| 8   | Plugin bind       | [`resolve-workspace-plugin.ts`](../src/workspace/resolve-workspace-plugin.ts)                       | `resolveWorkspacePluginForType` 18–30    | Workspace → `WorkspacePlugin` before engine create                            |
| 9   | Platform core     | [`platform-wizard.engine.ts`](../../../packages/platform-core/src/engine/platform-wizard.engine.ts) | `validateCanonical` 164–177              | `tryInit` / `validateCanonicalDocument` → `ValidationResult`                  |
| 10  | Rule engine       | [`rule.engine.ts`](../../../packages/platform-core/src/engine/rule.engine.ts)                       | `RuleEngine` (via `buildRuntime`)        | Matrix evaluation inside `validateCanonicalDocument`                          |

**Workspace packages on hot path:** `packages/platform-core` (`PlatformWizardEngine`, `RuleEngine`), `packages/workspace-sdk` (`createCanonicalDocument`, `assertCanonicalDocument`, starter `basic` rule cell), `packages/workspaces/starter` (plugin via API registry). **Not** on default listener: legacy Denali `FormRuleEngine`.

**Tests cited:** [`5.2-plugin-validation.spec.ts`](../test/5.2-plugin-validation.spec.ts), [`feature-flag-degradation.spec.ts`](../test/4-integration/feature-flag-degradation.spec.ts), [`validation-gate-concurrency.spec.ts`](../test/1-functional/validation-gate-concurrency.spec.ts).

```mermaid
sequenceDiagram
  participant TS as ToursService
  participant FF as resolveTenantFeatureFlags
  participant PT as runPreTransactionValidation
  participant CV as validateCanonicalBeforePersist
  participant PWE as PlatformWizardEngine
  participant TX as withCanonicalTransaction

  TS->>FF: advancedRuleEngine flag
  FF-->>TS: validationVariant basic|default
  TS->>PT: create/update body
  PT->>CV: sync validate (scheduler)
  CV->>PWE: getOrCreateValidationEngine + validateCanonical
  alt result.ok
    PWE-->>CV: ok
    CV-->>PT: CanonicalDocument
    PT->>PT: openGates.set(tenantId)
    TS->>TX: persist (consume gate)
  else result.ok false OR throw
    Note over TS: No switch to basic on failure
    PT-->>TS: ValidationFailure 400 or unhandled 500
  end
```

### Engine service failure vs rule violation

| Failure class                                                         | Platform-core behavior                                              | API behavior                                            | Fallback to `basic`?                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| **Rule violation** (e.g. missing `basics.title` in `default` variant) | `ValidationResult` `ok: false` + violations                         | `throwValidationFailure` → **400** `VALIDATION_FAILURE` | **No**                                                       |
| **Engine init / service** (`tryInit` / `buildRuntime` fail)           | `validationResultFromPlatformError` → same `ValidationResult` shape | `!result.ok` → `throwValidationFailure` → **400**       | **No** — not distinguished from business rules at HTTP layer |
| **Plugin ingress at `create`**                                        | `PlatformWizardEngine.create` may **throw**                         | Uncaught → **500** `internal_error`                     | **No**                                                       |
| **Unhandled throw** in validation stack                               | —                                                                   | `pre-transaction-validation.ts:43` rethrow → **500**    | **No**                                                       |

Platform-core: init failures are **not cached**; each `validateCanonical` re-attempts `tryInit` (`platform-wizard.engine.ts` 67, 180–185). API does **not** catch init failure and retry with `validationVariant: "basic"`.

### Degradation paths (proactive only) — count = 2

| ID           | Entry                                  | File:line                                                                                                                                                                                                                     | Behavior                                                           | HTTP on success                                 |
| ------------ | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------- |
| **GD-RE-01** | Theme flag `advancedRuleEngine: false` | [`resolve-tenant-feature-flags.ts`](../src/tenant/resolve-tenant-feature-flags.ts) 28–37 → [`tours.service.ts`](../src/tours/tours.service.ts) 27 → [`canonical-validation.ts`](../src/tours/canonical-validation.ts) 129–131 | Separate LRU slot `tenant:workspace:basic`; relaxed starter matrix | **201** on bodies invalid under advanced only   |
| **GD-RE-02** | Mid-load DB flag flip (no restart)     | [`feature-flag-degradation.spec.ts`](../test/4-integration/feature-flag-degradation.spec.ts)                                                                                                                                  | Same as GD-RE-01 after uncached `resolveTenantFeatureFlags` read   | **201** tenant A; **400** tenant B on same body |

**Not a degradation path:** [`resolve-tenant-feature-flags.ts`](../src/tenant/resolve-tenant-feature-flags.ts) 16–18, 58–71 — unknown / missing tenant defaults **`advancedRuleEngine: true`** (fail-safe strictness).

### Hard-fail registry — no runtime degradation — count = 16

All rows block tour persist and outbox enqueue (RULE-003) unless noted. None auto-retry with `validationVariant: "basic"`.

| ID           | File:line                                                                                                   | Failure mode                                                                       | HTTP           | Degradation path                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------- |
| **HF-RE-01** | [`canonical-validation.ts:134-136`](../src/tours/canonical-validation.ts)                                   | `engine.validateCanonical` → `!result.ok` (rules **or** engine init as violations) | **400**        | None                                                                                   |
| **HF-RE-02** | [`canonical-validation.ts:120-122`](../src/tours/canonical-validation.ts)                                   | `createCanonicalDocument` → `CanonicalDocumentValidationError`                     | **400**        | None                                                                                   |
| **HF-RE-03** | [`canonical-validation.ts:108`](../src/tours/canonical-validation.ts)                                       | `throwSchemaVersionMismatch`                                                       | **400**        | None                                                                                   |
| **HF-RE-04** | [`canonical-validation.ts:127`](../src/tours/canonical-validation.ts)                                       | `assertCanonicalDocument` throw not wrapped as `ValidationFailure`                 | **500**        | None (gap vs HF-RE-02)                                                                 |
| **HF-RE-05** | [`canonical-validation.ts:124`](../src/tours/canonical-validation.ts)                                       | Non-`CanonicalDocumentValidationError` from `createCanonicalDocument`              | **500**        | None                                                                                   |
| **HF-RE-06** | [`canonical-validation.ts:78`](../src/tours/canonical-validation.ts)                                        | `PlatformWizardEngine.create(plugin)` throw (plugin ingress)                       | **500**        | None                                                                                   |
| **HF-RE-07** | [`resolve-workspace-plugin.ts:28`](../src/workspace/resolve-workspace-plugin.ts)                            | `WORKSPACE_PLUGIN_NOT_FOUND`                                                       | **500**        | None                                                                                   |
| **HF-RE-08** | [`resolve-workspace-plugin.ts:24`](../src/workspace/resolve-workspace-plugin.ts)                            | `WORKSPACE_PLUGIN_NOT_BOUND`                                                       | **400**        | None                                                                                   |
| **HF-RE-09** | [`pre-transaction-validation.ts:43`](../src/canonical/pre-transaction-validation.ts)                        | Unhandled rethrow after validation (gate cleared at 35)                            | **500**        | None                                                                                   |
| **HF-RE-10** | [`with-canonical-transaction.ts:52-54`](../src/db/with-canonical-transaction.ts)                            | `CANONICAL_TX_VALIDATION_GATE_REQUIRED`                                            | **500**        | None — [`5.2-plugin-validation.spec.ts:97-104`](../test/5.2-plugin-validation.spec.ts) |
| **HF-RE-11** | [`with-canonical-transaction.ts:20`](../src/db/with-canonical-transaction.ts)                               | `CANONICAL_TX_TENANT_REQUIRED`                                                     | **500**        | None                                                                                   |
| **HF-RE-12** | [`canonical-tour.service.ts:87-92`](../src/canonical/canonical-tour.service.ts)                             | `CanonicalSyncValidationError` after validation passed                             | **409**        | None                                                                                   |
| **HF-RE-13** | [`canonical-tour.service.ts:21,69`](../src/canonical/canonical-tour.service.ts)                             | `CANONICAL_WRITE_TENANT_MISMATCH`                                                  | **500**        | None                                                                                   |
| **HF-RE-14** | [`create-tour.schema.ts:29`](../src/tours/create-tour.schema.ts)                                            | `ZOD_VALIDATION_FAILED` (pre-engine body)                                          | **400**        | None                                                                                   |
| **HF-RE-15** | [`tours.service.ts:69-70`](../src/tours/tours.service.ts)                                                   | `FORBIDDEN_TENANT_CLAIM_MISMATCH`                                                  | **403**        | None                                                                                   |
| **HF-RE-16** | [`platform-wizard.engine.ts:166-167`](../../../packages/platform-core/src/engine/platform-wizard.engine.ts) | `tryEnsureRuntime` / `tryInit` failure → violations (API: HF-RE-01)                | **400** at API | None                                                                                   |

**HTTP mapping:** [`error-interceptor.ts`](../src/middleware/error-interceptor.ts) — `ValidationFailure` / `CANONICAL_VALIDATION_FAILED` → 400 (154–160, 73); unmapped messages → **500** (197–200).

### Soft-fail, gate-open, and test-only paths (not degradation)

| Path                                    | File:line                                                                               | Purpose                                   | Skips Rule Engine?                                                                     |
| --------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------- |
| **Gate open (success)**                 | [`pre-transaction-validation.ts:32`](../src/canonical/pre-transaction-validation.ts)    | Proves validation ran before TX           | No — after successful validate                                                         |
| **Gate closed on failure**              | [`pre-transaction-validation.ts:35`](../src/canonical/pre-transaction-validation.ts)    | Cleanup on throw                          | N/A — [`5.2-plugin-validation.spec.ts:181-185`](../test/5.2-plugin-validation.spec.ts) |
| **Gate consume**                        | [`pre-transaction-validation.ts:51-56`](../src/canonical/pre-transaction-validation.ts) | One-shot per tenant before `$transaction` | No                                                                                     |
| **`P5_VALIDATE_DELAY_MS`**              | [`pre-transaction-validation.ts:77-96`](../src/canonical/pre-transaction-validation.ts) | Test-only delay **after** sync validate   | No                                                                                     |
| **`P5_VALIDATION_MAX_CONCURRENT`** etc. | [`validation-scheduler.ts:17-41`](../src/canonical/validation-scheduler.ts)             | Fairness / yield (DEC-016)                | No                                                                                     |
| **`P5_VALIDATION_ENGINE_CACHE_SIZE`**   | [`canonical-validation.ts:32-38`](../src/tours/canonical-validation.ts)                 | LRU cap for engines                       | No                                                                                     |

**No production env** in `apps/api/src` skips `runPreTransactionValidation` or `validateCanonicalBeforePersist`.

### Integration with other Phase 4 themes

| Theme                        | Interaction                                                                                      |
| ---------------------------- | ------------------------------------------------------------------------------------------------ |
| **Feature flags (FF-RC-\*)** | Mid-burst toggle changes **proactive** variant only; does not recover failed advanced validation |
| **Saga / outbox**            | Validation failure → no TX → zero tour/outbox rows (5.2)                                         |
| **Schema drift**             | Version mismatch is HF-RE-03 (400), not engine degrade                                           |
| **Graceful shutdown**        | In-flight POST may be in sync validation; no engine-specific cancel                              |
| **Phase 3 NN-01**            | RuleEngine CPU starvation is separate from DEC-014 basic variant                                 |

### Prove commands (Rule Engine hard-fail / degradation)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma NODE_ENV=test

node --import tsx --test \
  test/5.2-plugin-validation.spec.ts \
  test/4-integration/feature-flag-degradation.spec.ts \
  test/1-functional/validation-gate-concurrency.spec.ts
```

**Doc cross-links:** [`feature-flag-degradation.md`](../../../docs/phase-5/appendices/feature-flag-degradation.md), [`validation-fairness.md`](../../../docs/phase-5/appendices/validation-fairness.md), DEC-014 / DEC-016 in [`IMPLEMENTATION-DECISIONS.md`](../../../docs/phase-5/appendices/IMPLEMENTATION-DECISIONS.md).

---

## Hot-reload tenant config — Partial Update audit

**Question:** If a tenant config update fails halfway or interleaves with reads, can the process be forced into an **invalid** or **mixed** config state?  
**Artifacts:** [`tenant-config.routes.ts`](../src/tenant/tenant-config.routes.ts), [`tenant-registry.ts`](../src/tenant/tenant-registry.ts), [`tenant-registry-cache.ts`](../src/tenant/tenant-registry-cache.ts), [`resolve-registered-tenant.ts`](../src/tenant/resolve-registered-tenant.ts), [`resolve-tenant-feature-flags.ts`](../src/tenant/resolve-tenant-feature-flags.ts), [`provisioning.service.ts`](../src/internal/provisioning.service.ts), [`routes/internal/tenants.ts`](../src/routes/internal/tenants.ts), [`dynamic-config-sync.spec.ts`](../test/4-integration/dynamic-config-sync.spec.ts).

**Cross-link:** Feature-flag mid-burst races ([§ Feature flags](#feature-flags--race-condition-risk-mid-burst-toggle)) share the same hot-reload surface; **FF-RC-02** ≡ **PU-05**, **FF-RC-03** ≡ **PU-03**.

### Write and read topology

```mermaid
sequenceDiagram
  participant Admin as Admin write (provision / SQL)
  participant PG as Postgres tenants row
  participant Cache as tenant-registry-cache (5s TTL)
  participant TC as GET /api/v2/tenant-config
  participant Tour as POST /tours

  Admin->>PG: tenant.update | upsert | create (single statement)
  Note over Admin,Cache: No invalidate() on production write path
  TC->>Cache: resolveRegisteredTenantById / BySubdomain
  alt cache hit
    Cache-->>TC: stale RegisteredTenant
  else cache miss
    TC->>PG: findUnique → setCached (byId and/or bySubdomain)
  end
  Tour->>Cache: resolveWorkspaceTypeForTenant
  Tour->>PG: resolveTenantFeatureFlags (uncached)
```

| Layer                                                           | Atomic? | Notes                                                                              |
| --------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------- |
| Postgres single `UPDATE` / `UPSERT` / `INSERT`                  | **Yes** | MVCC — readers see prior or new committed row; no torn column within one statement |
| `ProvisioningService.upsertSeedTenant` → `prisma.tenant.upsert` | **Yes** | `workspaceType`, `status`, `theme` in one UPSERT (`provisioning.service.ts:79-99`) |
| `ProvisioningService.provisionTenant` → `prisma.tenant.create`  | **Yes** | All identity fields in one `create`                                                |
| Application `theme` JSON semantics                              | **No**  | Prisma assigns whole JSON — partial `data.theme` **drops** omitted keys            |
| In-process `tenant-registry-cache`                              | **No**  | 5s TTL; **no** production invalidation after write                                 |
| Cross-path read coherence                                       | **No**  | Registry cached; feature flags + rate RPS uncached admin reads                     |

### Partial update definition

| Class        | Definition                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------------- |
| **PU-DB**    | Row reflects unintended subset of intended config (multi-statement admin workflow or destructive JSON replace) |
| **PU-CACHE** | Process serves snapshot older than committed Postgres                                                          |
| **PU-MIX**   | Readers combine fields from different generations (split cache vs direct DB)                                   |

**Not counted as partial-update risk:** Postgres abort mid-**single**-statement `UPDATE` — row stays at prior committed version (full statement rollback).

### Adversarial scenario matrix

| ID        | Failure / interleave                                                                              | Postgres after                          | In-process view                              | Invalid / mixed?                        | Recovery today                 | Test / evidence                                                                      |
| --------- | ------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------- | --------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| **PU-01** | Two `tenant.update` calls (e.g. `theme` then `workspaceType`); second fails                       | One column new, one old                 | Cache may serve either generation ≤5s        | **Yes**                                 | Partial — TTL                  | Inferred                                                                             |
| **PU-02** | Single `update` with partial `theme` (e.g. only `featureFlags`)                                   | Committed; other theme keys **removed** | `themeFromJson` strips flags from API anyway | **Yes** — app-layer destructive replace | Fail — no merge                | `feature-flag-degradation.spec.ts:287-294`                                           |
| **PU-03** | Admin write succeeds; **no** cache invalidation                                                   | Row new                                 | Registry cache stale ≤5s                     | **Yes** — **PU-CACHE**                  | Partial — TTL                  | `dynamic-config-sync.spec.ts` — test calls `resetTenantRegistryCacheForTests()` only |
| **PU-04** | Same tenant via **id** vs **subdomain** after partial cache warm                                  | Row new                                 | `byId` / `bySubdomain` maps may differ       | **Yes**                                 | Partial — independent TTL keys | `tenant-registry-cache.ts:9-10`                                                      |
| **PU-05** | `createTour` between `resolveWorkspaceTypeForTenant` (cache) and `resolveTenantFeatureFlags` (DB) | Row may flip mid-request                | Mixed workspace + variant                    | **Yes** — **PU-MIX**                    | Fail                           | **FF-RC-02**; `tours.service.ts:25-27`                                               |
| **PU-06** | Mid-load flag flip while registry cache warm                                                      | Row new flags                           | Validation fresh; tenant-config cached       | **Yes**                                 | Partial — TTL on config API    | **FF-RC-01**, **FF-RC-03**                                                           |

**`partial_update_risk_count=6`** (PU-01 … PU-06).

### Atomic update paths (parent handoff)

| Path                                                                       | DB single-statement?     | E2E coherent hot-reload?                   |
| -------------------------------------------------------------------------- | ------------------------ | ------------------------------------------ |
| `ProvisioningService.upsertSeedTenant`                                     | **Yes**                  | **No** — cache not invalidated             |
| `ProvisioningService.provisionTenant` / `POST /internal/tenants/provision` | **Yes**                  | **No**                                     |
| Ad-hoc `getPrismaAdmin().tenant.update`                                    | **Yes** per call         | **No** — multi-call = PU-01; cache = PU-03 |
| `GET /api/v2/tenant-config`                                                | N/A (read-through cache) | **No** — up to 5s lag                      |
| `resolveTenantFeatureFlags`                                                | N/A (uncached read)      | **Yes** for flags slice                    |

**Summary:** `atomic_update_paths_db=yes` · `atomic_update_paths_e2e=no`

### Read-during-write, transactions, stale mixed config

| Concern                                                | Verdict                                           |
| ------------------------------------------------------ | ------------------------------------------------- |
| Torn read on `tenants` row (single `UPDATE`)           | **Pass** — row-level atomicity                    |
| Read-during-write across **multiple** admin statements | **Partial** — PU-01 window between commits        |
| DB + cache as one unit                                 | **Fail** — no transaction; commit ≠ cache publish |
| Stale cache serving mixed config with live flags       | **Fail** — PU-03, PU-05, PU-06                    |

### Cache invalidation on write

| Write site                                                 | Invalidates registry cache?                                |
| ---------------------------------------------------------- | ---------------------------------------------------------- |
| `ProvisioningService.upsertSeedTenant` / `provisionTenant` | **No**                                                     |
| `POST /internal/tenants/provision`                         | **No**                                                     |
| Production admin / migration scripts                       | **No**                                                     |
| `dynamic-config-sync` harness                              | **Yes** — `resetTenantRegistryCacheForTests()` (test-only) |

Phase 0 roadmap cited `invalidate(tenantId)` — **not implemented** in `tenant-registry-cache.ts` (only `resetTenantRegistryCacheForTests`).

### Partial-update findings

| ID      | Severity | Finding                                                                | Gap                                                                            |
| ------- | -------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| PU-F-01 | High     | No write-path cache invalidation after `upsert` / `update`             | Add `invalidateTenantRegistryCache(id, subdomain?)` on provision + ops runbook |
| PU-F-02 | High     | Split read paths in `ToursService` (cached workspace + uncached flags) | Single snapshot read or ALS-bound config version (**PU-05** / **FF-RC-02**)    |
| PU-F-03 | Medium   | Destructive theme JSON replace on partial admin payload                | Merge-patch helper; reject partial theme in provision schema                   |
| PU-F-04 | Medium   | Dual cache maps without linked invalidation                            | Invalidate both `byId` and `bySubdomain` on write                              |
| PU-F-05 | Medium   | Multi-statement admin updates — column-level mixed generation          | Document single-transaction bundle for ops                                     |
| PU-F-06 | Low      | Tests mask production gap via manual cache reset                       | Negative spec: stale window without `resetTenantRegistryCacheForTests`         |
| PU-F-07 | Pass     | Single-statement Prisma writes — no torn Postgres row                  | Keep one statement per mutation                                                |

### Prove commands (partial update / hot-reload)

Same as [Prove commands (feature flags)](#prove-commands-feature-flags) — `dynamic-config-sync.spec.ts` proves DB → API without restart when cache is reset; `feature-flag-degradation.spec.ts` proves mid-load flag flip without 503.

---

## Outbox status model

| Status       | Set by                                                           | Terminal? | Relay re-claims?                 |
| ------------ | ---------------------------------------------------------------- | --------- | -------------------------------- |
| `pending`    | `enqueueOutboxEvent` on insert                                   | No        | Yes (`WHERE status = 'pending'`) |
| `processing` | `claimPendingOutboxBatch` in same TX as `FOR UPDATE SKIP LOCKED` | No        | **No** — not in claim predicate  |
| `done`       | `publishClaimedOutboxRow` after successful publish               | Yes       | **No** (INT-SAGA-01)             |
| `failed`     | `markOutboxFailed` on publish/validation error                   | Yes       | **No** (INT-SAGA-03)             |

Index support: partial `outbox_events_pending_created_at_idx` on pending rows; no index or job for stale `processing`.

---

## Zombie event definition

For this audit, a **zombie event** is any domain message whose **system-of-record state** and **downstream effects** can diverge without an automated repair path:

| Class                       | Definition                                                                                                                    | Example in this codebase                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **Relay zombie (OZ-R)**     | `outbox_events` row stuck in `processing`, or committed `pending`/`processing` while relay cannot progress without manual SQL | Relay SIGKILL after claim TX commits, before `done` update                 |
| **Delivery zombie (OZ-D)**  | Bus delivered (or logically emitted) but consumer side-effects incomplete, while outbox shows `done`                          | `processed_domain_events` claimed, projection handler throws (INT-SAGA-01) |
| **Terminal poison (OZ-F)**  | Row in `failed`; relay will never retry                                                                                       | Payload tenant mismatch (INT-SAGA-03)                                      |
| **Orphan aggregate (OZ-A)** | Tour/audit without matching outbox (or inverse) after aborted TX                                                              | Chaos audit (`chaos-db-assertions.ts`); SIGKILL best-effort                |

**Not a zombie (recoverable backlog):** `pending` rows with relay enabled — normal queue; `event-backlog-recovery.spec.ts` drains to `done`.

**Zombie risk count (adversarial scenarios):** **6** rows marked **Zombie risk** in the [scenario matrix](#scenario-matrix) below (OZ-01 … OZ-06).

---

## Consumer down 1h — backlog replay and ordering

**Assumption:** Outbox relay and/or domain-event subscribers are unavailable for ~1 hour while API continues to commit canonical writes (`pending` outbox rows accumulate). Relay and subscribers then restart; no manual SQL on `outbox_events` or `processed_domain_events`.

### Recovery path (what happens on resume)

```mermaid
sequenceDiagram
  participant DB as outbox_events pending
  participant Relay as processOutboxRelayOnce
  participant Bus as publishDomainEvent
  participant Sub as subscribeIdempotentDomainEvent
  participant Log as processed_domain_events

  Note over DB: 1h downtime — rows stay pending
  Relay->>DB: claim ORDER BY created_at ASC LIMIT batch
  Relay->>Bus: publish (up to OUTBOX_RELAY_PUBLISH_CONCURRENCY parallel)
  Bus->>Sub: at-least-once delivery possible
  Sub->>Log: tryClaimProcessedDomainEvent UNIQUE
  alt first delivery
    Sub->>Sub: handler side effects once
  else duplicate replay
    Sub->>Sub: return early — no handler
  end
  Relay->>DB: status done per row
```

| Step        | Mechanism                                                              | 1h-backlog implication                                                                                                       |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Durability  | `pending` survives relay stop (`OZ-05`)                                | Backlog depth = writes during outage only                                                                                    |
| Claim order | `ORDER BY created_at ASC` on `claimPendingOutboxBatch`                 | **Global** FIFO by enqueue time, not partitioned per `tenant_id`                                                             |
| Publish     | `runWithConcurrency` default **16** (`outbox-relay-config.ts`)         | Rows in one batch — including multiple rows for the **same tenant** — can reach the bus **out of strict `created_at` order** |
| Delivery    | In-process `EventEmitter`; async handlers                              | No cross-event ordering contract on the bus                                                                                  |
| Dedupe      | `tryClaimProcessedDomainEvent` → UNIQUE `(tenant_id, domain_event_id)` | Replay of the same `domain_event_id` does **not** re-run handler body (`idempotent-domain-event-subscriber.ts`)              |
| Tests       | `event-backlog-recovery.spec.ts` INT-BACKLOG-01…03                     | FIFO + dedupe proven under **tenant-scoped** relay + `OUTBOX_RELAY_BATCH_SIZE=1`                                             |

### Duplicate replay — Data Integrity Breach assessment

A **Data Integrity Breach** here means: at-least-once replay causes **duplicate handler side effects** because the consumer path lacks durable idempotency.

| Path                                                                | Replay after 1h backlog?                                                       | Duplicate handler runs?                                                      | Verdict                                     |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------- |
| **`subscribeIdempotentDomainEvent`** + Postgres                     | Yes — relay drain, bus replay, manual `publishClaimedOutboxRow` on `done` rows | **No** — `tryClaimProcessedDomainEvent` returns `false` on P2002             | **Not a breach**                            |
| **`subscribeDomainEvent` only** (bus in-memory dedupe, capacity 64) | Yes                                                                            | **Yes** once dedupe window exceeded or new process                           | **Latent breach** — not production contract |
| **Malicious / poison envelope**                                     | N/A                                                                            | Claim blocked before log (`domain-event-consistency.spec.ts` PENTEST-EVT-02) | **Not a breach** (no processed row)         |

**`data_integrity_breach_count` (this audit):** **0** — mandated Postgres consumer uses `processed_domain_events`; INT-BACKLOG-02 holds handler runs at N after replaying 200 bus events + manual relay replay; INT-SAGA-02 / saga-rollback documents the same UNIQUE contract.

**At-least-once is expected:** After `OZ-02`, the bus may emit again while outbox is still `processing`; idempotency absorbs duplicates. That is **not** counted as a Data Integrity Breach when subscribers use the idempotent API.

### FIFO strictly per tenant?

| Configuration                                                                          | FIFO per `tenant_id`?  | Evidence                                                                                           |
| -------------------------------------------------------------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------- |
| **Production default** — `processOutboxRelayOnce`, batch 10, publish concurrency 16    | **No**                 | Global `ORDER BY created_at`; parallel `publishClaimedBatch`; no per-tenant partition in claim SQL |
| **Tenant-scoped relay** — `processOutboxRelayForTenantOnce`, batch 1, sequential drain | **Yes** (test profile) | INT-BACKLOG-01: `deliveryOrder` equals `seq` 0…N-1                                                 |
| **Single row per batch, concurrency 1**                                                | **Yes** (degenerate)   | Claim order equals publish order for that batch                                                    |

**`fifo_guaranteed_per_tenant` (production relay):** **no**

**Ordering note:** Global `created_at` ordering does **not** imply per-tenant ordering when multiple tenants interleave in one batch or publishes race. Handlers that require causal ordering across event types for one tenant must enforce it in application logic (or use batch size 1 + tenant-scoped relay — not deployed in `start-outbox-relay.ts` today).

### Backlog scenario matrix row

| ID        | Failure point                             | DB / outbox after 1h         | On resume                                                            | Data Integrity Breach?             | FIFO per tenant?                                     | Test evidence                                                                          |
| --------- | ----------------------------------------- | ---------------------------- | -------------------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **BL-01** | Relay/subscriber down 1h; writes continue | `pending` backlog per tenant | Relay claims `pending` → publish → `done`; idempotent skip on replay | **0** (with idempotent subscriber) | **No** (prod); **Yes** (tenant relay + batch 1 test) | `event-backlog-recovery.spec.ts` INT-BACKLOG-01…03; `domain-event-consistency.spec.ts` |

---

## Scenario matrix

Assumption for “mid-transaction” adversarial cases: failure can occur at any await boundary or process death (SIGKILL). “Bus” = in-process `publishDomainEvent` (`@app-tour/platform-events`).

| ID        | Failure point                                             | DB / outbox state after failure    | Bus / consumer state                             | Zombie class | Auto recovery today                                                          | Test evidence                                                                   |
| --------- | --------------------------------------------------------- | ---------------------------------- | ------------------------------------------------ | ------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **TX-01** | Throw before outbox insert (`before_outbox`)              | TX rolled back: no tour, no outbox | No publish                                       | —            | **Pass** — full rollback                                                     | `outbox-transactional.integration.spec.ts`                                      |
| **TX-02** | Throw on outbox insert (`P5_ATOMIC_TX_TEST_ABORT=outbox`) | Rolled back                        | No publish                                       | —            | **Pass**                                                                     | `outbox-transactional.integration.spec.ts`                                      |
| **TX-03** | Throw after outbox, before commit (`pre_commit`)          | Rolled back                        | No publish                                       | —            | **Pass**                                                                     | `outbox-transactional.integration.spec.ts`                                      |
| **TX-04** | SIGKILL / `process_exit` inside open canonical TX         | Best-effort rollback (Postgres)    | No publish                                       | OZ-A (risk)  | **Partial** — chaos subprocess audit                                         | `atomic-rollback-stress.spec.ts`, `atomic-canonical-tour-persist.ts`            |
| **OZ-01** | Relay crash after claim → `processing`, before publish    | `processing`                       | Maybe no delivery                                | OZ-R         | **Fail** — no reclaim                                                        | Inferred; claim only selects `pending`                                          |
| **OZ-02** | Crash after `publishDomainEvent`, before `status=done`    | `processing`                       | At-least-once delivered                          | OZ-R         | **Partial** — consumers idempotent; outbox stuck                             | Inferred from `publishClaimedOutboxRow` ordering                                |
| **OZ-03** | Publish validation error (tenant payload mismatch)        | `failed` + `processedAt`           | Not delivered                                    | OZ-F         | **Fail** — no relay retry                                                    | `saga-rollback.spec.ts` INT-SAGA-03, `domain-event-consistency.spec.ts`         |
| **OZ-04** | Projection throws after successful relay                  | `done`                             | Delivered; `processed_domain_events` claimed     | OZ-D         | **Partial** — `projection.inconsistency` log/metric; manual ops              | `saga-rollback.spec.ts` INT-SAGA-01/02                                          |
| **OZ-05** | Relay disabled / process down; outbox `pending`           | `pending` (committed)              | No delivery                                      | — (backlog)  | **Pass** when relay restarts; dedupe on replay (**0** Data Integrity Breach) | `event-backlog-recovery.spec.ts` INT-BACKLOG-01…03                              |
| **BL-01** | Consumer down ~1h (relay/subscriber); API still enqueues  | `pending` backlog                  | Resume drain; at-least-once bus; idempotent skip | — (backlog)  | **Pass** dedupe; **Partial** FIFO                                            | **No** prod / **Yes** test profile                                              | See [§ Consumer down 1h](#consumer-down-1h--backlog-replay-and-ordering) |
| **OZ-06** | Graceful shutdown with rows in `processing`               | `processing` may remain            | Unknown                                          | OZ-R         | **Partial** — flush counts only `pending`                                    | `graceful-shutdown.ts`, **SD-G1**; runtime drain in `graceful-shutdown.spec.ts` |

---

## Recovery flows

### 1. Canonical write saga (happy path)

1. **Ingress** — `parseCreateTourBody` / `parseUpdateTourBody` (Zod; optional `schemaVersion`).
2. **`runPreTransactionValidation`** (outside TX) — `validateCanonicalBeforePersist`: workspace current revision check, optional `defaultCanonicalData`, plugin RuleEngine gate ([§ Schema drift](#schema-drift--tour-payload-version-mismatch)).
3. `withCanonicalTransaction` → `tour.create` → `appendAuditEvent` → `enqueueOutboxEvent` (`pending`).
4. Commit → HTTP response / caller continues.
5. Relay (separate timer): claim → publish → `done`.

**Schema drift boundary:** `SchemaVersionMismatchError` and `ValidationFailure` throw at step 2 — **before** any canonical TX or outbox enqueue (RULE-003). Saga partial-success classes (OZ-04) cannot occur on version-mismatch rejects because no row is committed.

**Idempotency at enqueue:** duplicate `(tenant_id, domain_event_id)` returns `false` (P2002 swallowed) — safe for duplicate command attempts inside a retried TX.

### 2. Canonical TX failure (rollback)

All steps in §1.2 share one Prisma transaction. Any throw (including test hooks `P5_ATOMIC_TX_TEST_ABORT`) aborts tour, audit, and outbox together.

```text
persistNewTourAtomically
  └─ withCanonicalTransaction
       ├─ tour.create
       ├─ appendAuditEvent
       ├─ enqueueOutboxEvent  → status pending (uncommitted until commit)
       └─ COMMIT | ROLLBACK
```

**Recovery:** Client retries; no outbox row survives rollback (proven in integration spec).

### 3. Relay failure recovery (what exists)

| Mechanism              | Behavior                                                            | Gap                                                        |
| ---------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Pending poll**       | `processOutboxRelayOnce` / `startOutboxRelayIfEnabled`              | Does not see `processing` or `failed`                      |
| **SKIP LOCKED claim**  | Multi-instance safe single claimer per row                          | Claim + `processing` update atomic in admin TX             |
| **Publish failure**    | `catch` → `markOutboxFailed`                                        | Terminal; no DLQ retry                                     |
| **At-least-once bus**  | `domain_event_id` → `processed_domain_events` UNIQUE                | Handler skip on replay; does not fix stuck outbox          |
| **Manual replay**      | `publishClaimedOutboxRow` on `done` row                             | Idempotent handler no-ops; **does not reset `processing`** |
| **Projection partial** | `recordProjectionInconsistency`                                     | No compensating transaction                                |
| **Graceful shutdown**  | `flushOutboxRelay` loops `processOutboxRelayOnce` until `pending=0` | Ignores stuck `processing`                                 |

### 4. Crash-between-states (adversarial timeline)

```mermaid
stateDiagram-v2
  [*] --> pending: enqueue in canonical TX commit
  pending --> processing: claimPendingOutboxBatch
  processing --> done: publish OK + admin update
  processing --> failed: publish throws
  processing --> processing: relay crash OZ-01 OZ-02
  failed --> [*]: manual ops only
  done --> [*]: relay will not re-claim
```

**OZ-02 detail:** `publishDomainEvent` runs, then `getPrismaAdmin().outboxEvent.update({ status: 'done' })`. Non-transactional pairing → classic “message in flight, DB not terminal” window. Consumers tolerate duplicate delivery; **outbox row does not self-heal**.

**OZ-04 detail:** Idempotent subscriber claims `processed_domain_events` **before** handler body. Handler failure records inconsistency but **does not roll back** outbox `done` or processed log — intentional partial success (`projection-reconciliation.ts` DEC-008).

### 5. Test-backed recovery verdicts

| Spec                                       | Proves recovery for                                                                                                                      |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `outbox-transactional.integration.spec.ts` | Atomic rollback; no in-process publish before commit                                                                                     |
| `outbox-relay.integration.spec.ts`         | SKIP LOCKED, delivery, `done`                                                                                                            |
| `saga-rollback.spec.ts`                    | Partial saga; no re-claim of `done`; `failed` terminal                                                                                   |
| `event-backlog-recovery.spec.ts`           | 1h-style backlog: FIFO under tenant relay + batch 1; bus/relay replay dedupe (INT-BACKLOG-02); crash + bus reset resume (INT-BACKLOG-03) |
| `domain-event-consistency.spec.ts`         | Poison outbox → `failed`; guard before processed log                                                                                     |
| `atomic-rollback-stress.spec.ts`           | Orphan counts after chaos abort modes                                                                                                    |

---

## Findings table

| ID       | Severity | Finding                                                                                  | Exists today                                                                 | Gap / recommendation                                                                           |
| -------- | -------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| F-01     | High     | No **stale `processing` reclaim** (time-boxed reset to `pending` or dead-letter)         | Claim filters `status = 'pending'` only                                      | OZ-01, OZ-02, OZ-06 — ops runbook + SQL; add relay job in Phase 5+                             |
| F-02     | High     | **Publish / mark-done not atomic** — bus can lead DB                                     | Sequential publish then update                                               | Compensate via reclaim (F-01) or outbox pattern with external broker TX id                     |
| F-03     | Medium   | **`failed` is terminal** — no automatic retry or quarantine replay                       | `markOutboxFailed`; INT-SAGA-03                                              | Admin replay tooling; distinguish transient vs poison                                          |
| F-04     | Medium   | **Saga partial success** — outbox `done` + processed claim + failed projection           | `recordProjectionInconsistency`                                              | No DLQ; manual reconciliation (documented in tests)                                            |
| F-05     | High     | **Graceful shutdown** flush ignores `processing`                                         | `flushOutboxRelay` pending count only                                        | **SD-G1** — extend drain predicate or stale-`processing` reclaim (F-01) before exit            |
| F-11     | Medium   | **Shutdown flush silent timeout**                                                        | No non-zero exit when `pending > 0` after deadline                           | **SD-G3** — metric + ops alert                                                                 |
| F-12     | Medium   | **In-flight relay tick** not awaited on stop                                             | `outboxRelay.stop()` clears interval only                                    | **SD-G2** — await tick or barrier before flush                                                 |
| F-13     | Low      | **No shutdown deadline** on `server.close`                                               | Hung request blocks exit                                                     | **SD-G4**                                                                                      |
| F-14     | Low      | **Logger not drained** on shutdown                                                       | No `logger.flush` after close                                                | **SD-G5** — see phase3 LOG-BP-HARDEN-02                                                        |
| F-06     | Pass     | **Canonical atomicity** tour/audit/outbox                                                | `withCanonicalTransaction` + enqueue in TX                                   | Covered by integration + chaos hooks                                                           |
| F-07     | Pass     | **Enqueue idempotency**                                                                  | UNIQUE + P2002 in `enqueueOutboxEvent`                                       | —                                                                                              |
| F-08     | Pass     | **Consumer idempotency**                                                                 | `tryClaimProcessedDomainEvent`                                               | Replay safe (INT-SAGA-02, INT-BACKLOG-02)                                                      |
| F-09     | Pass     | **Multi-worker claim safety**                                                            | `FOR UPDATE SKIP LOCKED`                                                     | `outbox-relay.integration.spec.ts`                                                             |
| F-10     | Partial  | **SIGKILL mid canonical TX**                                                             | Chaos audit                                                                  | Best-effort; monitor OZ-A                                                                      |
| F-15     | Medium   | **No strict FIFO per tenant** in production relay                                        | Global `ORDER BY created_at` + `OUTBOX_RELAY_PUBLISH_CONCURRENCY` default 16 | BL-01 / INT-BACKLOG-01 — order-sensitive projections need explicit sequencing or config change |
| F-16     | Pass     | **Backlog replay dedupe** — no Data Integrity Breach on idempotent path                  | `processed_domain_events` + INT-BACKLOG-02                                   | **0** breaches; do not use raw `subscribeDomainEvent` for mutating handlers                    |
| CLK-F-01 | High     | **Atomic TX triple timestamp authority** — tour app-time vs audit/outbox DB-time         | `atomic-canonical-tour-persist.ts` + schema defaults                         | **CLK-TT-01** — unify on DB `now()` per TX; see [§ Clock skew](#clock-skew--time-travel-risks) |
| CLK-F-02 | High     | **`occurredAt` path split** — in-process app vs relay DB                                 | `bus.ts` default vs `outbox-relay.ts:199`                                    | **CLK-TT-02** — explicit DB-sourced `occurredAt` at enqueue                                    |
| CLK-F-03 | Medium   | **Relay / idempotency terminal timestamps** use app `new Date()` against DB `created_at` | `outbox-relay.ts`, `http-idempotency.ts`                                     | **CLK-TT-03/04** — SQL `now()` on terminal updates                                             |
| CLK-F-04 | Low      | **Clock skew spec gap at ±5s** — integration uses ±5min                                  | `clock-skew-resilience.spec.ts`                                              | Add CLK-SKEW-10 at exact drift budget                                                          |

---

## Idempotency and retry summary

| Layer                     | Key                                | On duplicate / retry                                                                                           |
| ------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Outbox insert             | `(tenant_id, domain_event_id)`     | Second insert skipped (`enqueueOutboxEvent` → `false`)                                                         |
| Relay claim               | Row id + SKIP LOCKED               | One worker per pending row                                                                                     |
| Bus delivery              | `eventId` = `domain_event_id`      | `processed_domain_events` UNIQUE — handler runs once; duplicates after 1h backlog **safe** (INT-BACKLOG-02)    |
| Per-tenant delivery order | —                                  | **Not guaranteed** in `processOutboxRelayOnce` (F-15); guaranteed only in tenant-scoped + batch-1 test profile |
| Outbox terminal           | `done` / `failed`                  | Relay does not re-claim (`saga-rollback` INT-SAGA-01, INT-SAGA-03)                                             |
| HTTP command              | `HttpIdempotencyRecord` (separate) | Not outbox relay; see `http-idempotency.ts`                                                                    |

**Relay retry:** Only implicit via new `pending` rows. **No** exponential backoff table; **no** `processing` timeout. Failed publish in a tick increments `failed` counter (`OutboxRelayProcessResult`) and logs on tick (`start-outbox-relay.ts`).

---

## Gaps vs Phase 5 documentation

[`5.4-transactional-outbox.md`](../../../docs/phase-5/subphases/5.4-transactional-outbox.md) documents the state machine `pending → processing → done | failed` and relay sequence. It does **not** specify:

- Maximum `processing` age or reclaim policy
- Retry policy for `failed`
- Pairing guarantee between bus publish and `done` update

This audit recommends adding those to platform docs when implementing F-01/F-03.

---

## Prove commands (regression)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma NODE_ENV=test

node --import tsx --test \
  test/outbox-transactional.integration.spec.ts \
  test/outbox-relay.integration.spec.ts \
  test/4-integration/saga-rollback.spec.ts \
  test/4-integration/event-backlog-recovery.spec.ts \
  test/4-integration/graceful-shutdown.spec.ts \
  test/1-reliability/domain-event-consistency.spec.ts \
  test/4-integration/schema-version-compat.spec.ts \
  test/4-integration/feature-flag-degradation.spec.ts \
  test/4-integration/dynamic-config-sync.spec.ts
```

Feature flags (mid-burst toggle): see [Prove commands (feature flags)](#prove-commands-feature-flags).

Nightly / large backlog: `TEST_TIER=nightly` for 1000-row `event-backlog-recovery.spec.ts`. Graceful shutdown: see [Prove commands (graceful shutdown)](#prove-commands-graceful-shutdown).

Proxy isolation (no Postgres):

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/4-integration/proxy-tenant-isolation.spec.ts
```

---

## Proxy isolation — outbound third-party calls

**Pass:** 2026-06-05 (static)  
**Question:** When a third-party map/enrichment upstream hangs, does the API shed load safely, or do unbounded awaits pile up on the request path?

### Scope and exclusions

| Area                                                                                                                                    | Reviewed?                   | Outbound HTTP?                                | Notes                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| [`tenant-http-proxy.ts`](../src/proxy/tenant-http-proxy.ts)                                                                             | **Yes**                     | **Yes** — global `fetch` to `upstreamBaseUrl` | Only third-party HTTP proxy seam in `apps/api/src`                  |
| [`provisioning.service.ts`](../src/internal/provisioning.service.ts)                                                                    | Yes                         | No                                            | Prisma admin only (`getPrismaAdmin`)                                |
| [`tenant-registry.ts`](../src/tenant/tenant-registry.ts) / [`resolve-registered-tenant.ts`](../src/tenant/resolve-registered-tenant.ts) | Yes                         | No                                            | Static `DEV_TENANTS` or Postgres lookup — no external registry HTTP |
| [`parse-jwt-bearer.ts`](../src/tenant-kernel/parse-jwt-bearer.ts)                                                                       | Yes                         | No                                            | Local RS256 verify via `jose` + PEM — no JWKS fetch                 |
| [`publishDomainEvent`](../src/outbox/outbox-relay.ts) / `@app-tour/platform-events`                                                     | Yes                         | No                                            | In-process bus — not a third-party proxy                            |
| **Redis** (`redis-rate-limiter-store.ts`)                                                                                               | Skipped (per audit charter) | TCP to `REDIS_URL`                            | Infrastructure dependency, not map/enrichment proxy                 |
| **Prisma / Postgres**                                                                                                                   | Skipped (per audit charter) | TCP to `DATABASE_URL`                         | Covered by pool-saturation / long-tx audits in Phase 3              |

**Production wiring:** [`main.ts`](../src/main.ts) does **not** instantiate `TenantHttpProxy` today. The seam is test-only until tour/map routes adopt it (see [`phase1-aggressive-audit.md`](./phase1-aggressive-audit.md) DI-PROXY-01). **Systemic risk is latent** — wiring without timeout/breaker would inherit PI-01 immediately.

**`fetch` inventory (`apps/api/src`):** ripgrep finds **one** call site — `TenantHttpProxy.fetch` line 52. No `http.request` / `https.request` / axios / undici client in production `src/`.

### Hang behavior — event loop vs request thread

Node’s native `fetch` (Undici) is **non-blocking for the event loop**: a slow upstream yields at `await` and other timers/I/O continue. A **hang is not a synchronous event-loop freeze**.

| Effect                      | When upstream never responds                                                                                                                                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event loop**              | Keeps processing other work                                                                                                                                                                                                                               |
| **Caller async chain**      | Stays pending until TCP/Undici gives up or caller aborts                                                                                                                                                                                                  |
| **Inbound HTTP request**    | Open until handler completes — client sees slow/hung response                                                                                                                                                                                             |
| **Concurrency / isolation** | Many hung proxy calls → connection pile-up, memory for buffers, tenant request slots held — **noisy-neighbor amplification** across tenants sharing the process                                                                                           |
| **Default timeout**         | `TenantHttpProxy` passes `{ ...init, method, headers }` only — **no** `signal`, **no** explicit timeout. Undici may apply long default header/body timeouts (order of minutes) or wait for OS TCP expiry on half-open connections — **not a bounded SLA** |

**Verdict:** Does **not** block the event loop synchronously; **does** block the **request thread** (async continuation) without a bounded fail-fast — qualifies as **Systemic Risk** when the proxy is on the hot path (PI-01).

```mermaid
sequenceDiagram
  participant C as Client
  participant H as HTTP handler
  participant P as TenantHttpProxy
  participant U as Third-party upstream

  C->>H: GET /tours/... (needs map enrich)
  H->>P: fetch(/geocode)
  P->>U: fetch (no AbortSignal)
  Note over U: upstream hangs
  Note over H,C: handler await pending — response not sent
  Note over H: other tenants' requests still schedule on event loop
```

### Outbound call inventory

| ID        | File                                                           | Target                                                           | Timeout?                              | Circuit breaker? | Async (non-blocking EL)?       | Systemic risk?                                                                       |
| --------- | -------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------- | ---------------- | ------------------------------ | ------------------------------------------------------------------------------------ |
| **PI-01** | [`tenant-http-proxy.ts:52`](../src/proxy/tenant-http-proxy.ts) | Configurable `upstreamBaseUrl` (map / geocode / enrichment HTTP) | **No** — relies on Undici/OS defaults | **No**           | **Yes** — `await fetch` yields | **Yes** — unbounded hang holds request; no tenant-scoped concurrency cap on outbound |

**Counts:** `outbound_call_count=1` · `systemic_risk_count=1`

### Test contract review

| Spec                                                                                     | Covers                                                                                     | Timeout / hang coverage?                                                                                    |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| [`proxy-tenant-isolation.spec.ts`](../test/4-integration/proxy-tenant-isolation.spec.ts) | ALS `x-tenant-id` injection; per-tenant GET cache isolation; parallel mixed-tenant fetches | **No** — mock upstream responds immediately; no slow/hung upstream, no `AbortSignal`, no deadline assertion |
| [`async-propagation.spec.ts`](../test/0-functional/async-propagation.spec.ts)            | ALS survives `MockExternalEnrichmentApi` async gaps (setImmediate/setTimeout)              | **No** — mock is in-process delays only, not HTTP; no hang test                                             |

**Gap:** No integration spec proves fail-fast under upstream hang, timeout propagation from inbound request, or circuit-open behavior after repeated failures.

### Proxy findings table

| ID    | Severity          | Finding                                                                                 | Exists today                                            | Gap / recommendation                                                                                                                                   |
| ----- | ----------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PI-01 | **Systemic Risk** | **`TenantHttpProxy.fetch`** — no `AbortSignal`, no explicit timeout, no circuit breaker | `await fetch(url, { ...init, method, headers })`        | Add bounded timeout (e.g. `AbortSignal.timeout(ms)`), optional breaker per upstream host, metrics on hang/timeout; wire before production map routes   |
| PI-02 | Medium            | **Per-tenant GET cache** unbounded in-memory `Map`                                      | `tenant-http-proxy.ts:28-66`                            | Phase 3 noted LRU+TTL gap ([`phase3-scalability-stress-audit.md`](./phase3-scalability-stress-audit.md)); memory growth under cache-enabled production |
| PI-03 | Low               | **Proxy not on production path**                                                        | Not referenced in `main.ts` / route handlers            | Reduces immediate exposure; does not remove PI-01 for Phase 5+ wiring                                                                                  |
| PI-04 | Pass              | **Tenant isolation on outbound**                                                        | Cache key `tenantId\0method\0url`; ALS header injection | `proxy-tenant-isolation.spec.ts`                                                                                                                       |

### Integration with saga / outbox sections

| Concern           | Outbox / saga (this doc §1–§5)       | Proxy isolation (this section)                                                                |
| ----------------- | ------------------------------------ | --------------------------------------------------------------------------------------------- |
| Failure domain    | Postgres TX + relay state machine    | External HTTP upstream availability                                                           |
| Partial success   | OZ-04 projection after `done`        | Hung upstream — no partial body; request stalls                                               |
| Idempotency       | Outbox + `processed_domain_events`   | GET cache replay-safe per tenant; mutations not cached                                        |
| Graceful shutdown | Flush **pending** outbox only (F-05) | In-flight proxy `fetch` not cancelled on SIGTERM — would add to shutdown drain gap when wired |
| Noisy neighbor    | Relay + DB pool (Phase 3)            | Shared process: one tenant’s hung map call consumes a worker slot until timeout               |
| Clock skew        | Mixed app/DB timestamps in atomic TX | Hung request duration unrelated; **forensic timeline** wrong after successful create          |

When map enrichment runs **inside** a canonical request handler, a hung PI-01 upstream extends request duration independently of outbox relay health — combine with F-05 / shutdown audits for full process drain policy.

### Prove commands (proxy)

```bash
cd apps/api && NODE_ENV=test STORAGE_DRIVER=memory node --import tsx --test test/4-integration/proxy-tenant-isolation.spec.ts
```

Recommended future spec (not implemented): mock upstream that never responds + assert handler rejects within N ms via proxy timeout.

---

## Schema drift — Tour payload version mismatch

**Pass:** 2026-06-05 (static + test-contract)  
**Adversarial question:** When an **old** service sends a Tour canonical payload that a **new** service would reject (stale `schemaVersion`, incomplete `data`, legacy root subset), does the API return **`500 internal_error`** instead of a structured **`SCHEMA_VERSION_MISMATCH`**, **`VALIDATION_FAILURE`**, or **default-fill `201`**?

**Verdict:** **No proven HTTP `500` on version drift** on tenant-facing write paths. **`schema_drift_critical_failure_count=0`**. **`schema_drift_graceful_paths_count=14`** (see [graceful path inventory](#graceful-path-inventory)).

### Scope (files reviewed)

| Artifact                                                                                                                      | Role                                                     |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`schema-version-policy.ts`](../src/canonical/schema-version-policy.ts)                                                       | Workspace current revision (`starter → 1`)               |
| [`schema-version-mismatch.ts`](../src/canonical/schema-version-mismatch.ts)                                                   | `SchemaVersionMismatchError` + enrichment                |
| [`canonical-validation.ts`](../src/tours/canonical-validation.ts)                                                             | Version check, `defaultCanonicalData`, RuleEngine gate   |
| [`pre-transaction-validation.ts`](../src/canonical/pre-transaction-validation.ts)                                             | Pre-TX gate; rethrows typed mismatch / validation errors |
| [`create-tour.schema.ts`](../src/tours/create-tour.schema.ts) / [`update-tour.schema.ts`](../src/tours/update-tour.schema.ts) | Ingress Zod (`schemaVersion` optional positive int)      |
| [`tours.routes.ts`](../src/tours/tours.routes.ts)                                                                             | `POST` / `PATCH` → `handleHttpError`                     |
| [`tours.service.ts`](../src/tours/tours.service.ts)                                                                           | Parse → `CanonicalTourService`                           |
| [`canonical-tour.service.ts`](../src/canonical/canonical-tour.service.ts)                                                     | Write + PATCH merge body                                 |
| [`legacy-canonical-adapter.ts`](../src/canonical/legacy-canonical-adapter.ts)                                                 | Read-only stub; **not** a migration bridge               |
| [`migrate-canonical-hook.ts`](../src/canonical/migrate-canonical-hook.ts)                                                     | Phase 6 hook — **not** invoked on write paths            |
| [`error-interceptor.ts`](../src/middleware/error-interceptor.ts)                                                              | Maps `SchemaVersionMismatchError` → **400**              |
| [`schema-version-compat.spec.ts`](../test/4-integration/schema-version-compat.spec.ts)                                        | Adversarial POST contract                                |

### End-to-end map (ingress → persist)

```mermaid
flowchart TD
  subgraph ingress [Ingress]
    A[POST/PATCH raw JSON] --> B{JSON.parse}
    B -->|SyntaxError| Z500[500 internal_error]
    B --> C[parseCreateTourBody / parseUpdateTourBody]
    C -->|Zod fail| Z400Z[400 ZOD_VALIDATION_FAILED]
  end

  subgraph gate [Pre-TX validation gate]
    C --> D[ToursService → CanonicalTourService]
    D --> E[runPreTransactionValidation]
    E --> F[validateCanonicalBeforePersist]
    F --> G{requestedSchemaVersion vs workspace current}
    G -->|≠| H[throwSchemaVersionMismatch]
    G -->|=| I[createCanonicalDocument + defaultCanonicalData if data omitted]
    I -->|CanonicalDocumentValidationError| J[ValidationFailure]
    I -->|other Error| Z500B[500 internal_error latent]
    I --> K[engine.validateCanonical]
    K -->|!ok| J
  end

  subgraph http [HTTP envelope]
    H --> L[handleHttpError isSchemaVersionMismatchError]
    L --> M[400 code SCHEMA_VERSION_MISMATCH]
    J --> N[400 code VALIDATION_FAILURE]
    K -->|ok| O[withCanonicalTransaction / scoped persist → 201 or 200]
  end
```

| Stage                  | Field / check                                                                           | Behavior on drift                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Ingress Zod**        | `schemaVersion?: number` (positive int)                                                 | Wrong **type** → `ZOD_VALIDATION_FAILED` **400** (not mismatch)                                               |
| **Implicit version**   | `requested = body.schemaVersion ?? resolveWorkspaceCurrentSchemaVersion(workspaceType)` | Omitted version **defaults to workspace current** — no false mismatch when client omits field                 |
| **Explicit mismatch**  | `requested !== current`                                                                 | `SchemaVersionMismatchError` **before** document build                                                        |
| **Canonical document** | `schemaVersion` on persisted `CanonicalDocument`                                        | Set from **requested** (post-default), stored on `tours.canonical` JSON + `schema_version` projection column  |
| **Validation gate**    | `runPreTransactionValidation` → `validateCanonicalBeforePersist`                        | Same gate for POST and PATCH merge path; blocks TX / outbox on failure                                        |
| **Error interceptor**  | `isSchemaVersionMismatchError` branch                                                   | **400** `{ error, code: "SCHEMA_VERSION_MISMATCH", correlationId }` — version numbers in message (ERR-400-03) |
| **Legacy adapter**     | `LegacyCanonicalAdapter.writeLegacyTour`                                                | **403** `DUAL_WRITE_FORBIDDEN` — not on HTTP tour path                                                        |
| **Phase 6 migration**  | `migrateCanonicalNotImplemented`                                                        | **Not called**; future bump requires explicit mismatch reject or new hook                                     |

**Workspace current revision today:** `starter → 1` ([`schema-version-policy.ts`](../src/canonical/schema-version-policy.ts)). Test **“stale schema rev”** sends `schemaVersion: 2` against current `1` → **400** `SCHEMA_VERSION_MISMATCH` (future client on old workspace).

### Integration with saga / outbox (this doc §1–§5)

| Concern                | Saga / outbox                                                                                             | Schema drift                                                                                                       |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Ordering**           | Validation **outside** canonical TX ([Recovery flows §1](#1-canonical-write-saga-happy-path))             | Mismatch / validation fail → **no** tour, audit, or `pending` outbox                                               |
| **Partial success**    | OZ-04: outbox `done` + failed projection                                                                  | **N/A** — reject before commit                                                                                     |
| **Relay payload**      | `TourCreated` carries `tourId` only — **no** `schemaVersion` on bus envelope                              | Stored canonical may be legacy shape; relay does **not** re-validate schema                                        |
| **Saga test fixtures** | [`saga-rollback.spec.ts`](../test/4-integration/saga-rollback.spec.ts) seeds `schemaVersion: 1` via admin | Direct DB insert bypasses HTTP gate; INT-SAGA-03 tests **tenant** mismatch on outbox payload, not canonical schema |
| **Graceful shutdown**  | In-flight POST may complete validation + TX                                                               | In-flight **400** mismatch responses complete during drain — no shutdown-specific schema gate                      |
| **Feature flags**      | Variant pinned per request before gate                                                                    | Does not alter `schemaVersion` policy                                                                              |

### Adversarial scenario matrix (HTTP write)

Assumption: **old service** = Phase 3/4 client or stored row shape; **new service** = current `apps/api` with workspace current `schemaVersion = 1`.

| ID        | Adversarial payload                                         | Expected new-service behavior                  | HTTP             | Structured code?                                  | 500 on drift?                   | Test evidence                                               |
| --------- | ----------------------------------------------------------- | ---------------------------------------------- | ---------------- | ------------------------------------------------- | ------------------------------- | ----------------------------------------------------------- |
| **SV-01** | `schemaVersion: 2` + valid future-shaped body               | Reject — workspace still at **1**              | **400**          | `SCHEMA_VERSION_MISMATCH`                         | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-02** | `schemaVersion: 1`, **`data` omitted**                      | Default-fill `basics.title`, `details.summary` | **201**          | — (success)                                       | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-03** | Empty body `{}`                                             | Implicit version + default-fill                | **201**          | —                                                 | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-04** | Legacy **basics-only** roots + valid title                  | Accept subset roots                            | **201**          | —                                                 | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-05** | `schemaVersion: 1`, partial `data` (missing `details` root) | Plugin / canonical shape reject                | **400**          | `VALIDATION_FAILURE`                              | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-06** | `schemaVersion: 1`, explicit `data: {}`                     | No default-fill when `data` key present        | **400**          | `VALIDATION_FAILURE`                              | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-07** | `schemaVersion: 1`, missing required `basics.title`         | RuleEngine violation                           | **400**          | `VALIDATION_FAILURE`                              | **No**                          | `schema-version-compat.spec.ts`                             |
| **SV-08** | `schemaVersion: "not-a-number"`                             | Zod ingress reject                             | **400**          | `ZOD_VALIDATION_FAILED`                           | **No**                          | `integration.routes.spec.ts`                                |
| **SV-09** | **PATCH** merge + stale explicit `schemaVersion`            | Same gate as POST (code parity)                | **400** inferred | `SCHEMA_VERSION_MISMATCH` or `VALIDATION_FAILURE` | **No** (inferred)               | **Gap** — no PATCH cases in `schema-version-compat.spec.ts` |
| **SV-10** | **GET** stored legacy canonical                             | No re-validation on read                       | **200**          | —                                                 | **No**                          | By design                                                   |
| **SV-11** | Malformed JSON body                                         | `JSON.parse` throws before schema logic        | **500**          | `internal_error`                                  | **Yes** — **not version drift** | Inferred from `tours.routes.ts`                             |

### Critical failure inventory {#critical-failure-inventory}

A **critical failure** is any **tenant-facing Tour write path** where **schema version drift** (explicit mismatch, legacy shape at matching version, or post-bump stored version disagreeing with workspace current) surfaces as **`500 internal_error`** without `SCHEMA_VERSION_MISMATCH`, `VALIDATION_FAILURE`, or intentional default-fill success.

| ID             | Path                                                                     | 500 on version drift?                                | Verdict             |
| -------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- | ------------------- |
| **SV-CRIT-01** | `POST /tours` — all adversarial cases in `schema-version-compat.spec.ts` | **No**                                               | **Pass**            |
| **SV-CRIT-02** | `PATCH /tours/:id` — same `runPreTransactionValidation` gate             | **No** (code parity; untested HTTP)                  | **Pass** (inferred) |
| **SV-CRIT-03** | `CanonicalTourService.writeTour` direct                                  | **No** — throws `ValidationFailure`                  | **Pass**            |
| **SV-CRIT-04** | Outbox relay / idempotent subscriber                                     | **N/A** — no canonical schema validation on delivery | **Pass** (non-HTTP) |

**`schema_drift_critical_failure_count=0`** — no row in the matrix above is a confirmed **500 on version drift**.

**Adjacent ingress (not counted):** **SV-11** — malformed JSON → **500** before Zod or schema gate; harden separately if product requires **400** parse errors.

**Latent (not counted as critical — not proven on drift payloads):**

| ID            | Condition                                                               | Risk                                                                                               |
| ------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **SV-LAT-01** | `createCanonicalDocument` throws non-`CanonicalDocumentValidationError` | Unmapped → **500** via `mapErrorMessageToStatus`                                                   |
| **SV-LAT-02** | Phase 6 wires `migrateCanonicalNotImplemented` without handler          | `MIGRATE_CANONICAL_NOT_IMPLEMENTED_PHASE_5` → **500**                                              |
| **SV-LAT-03** | Workspace bump to `2` while old clients **omit** `schemaVersion`        | Defaults to **2** — silent upgrade path, not mismatch; shape errors → **400** `VALIDATION_FAILURE` |

### Graceful path inventory

**`schema_drift_graceful_paths_count=14`**

| #   | Path                                                   | Outcome                                   |
| --- | ------------------------------------------------------ | ----------------------------------------- |
| 1   | POST — omit `data`, version 1 or implicit              | **201** default-fill                      |
| 2   | POST — empty body                                      | **201** default-fill                      |
| 3   | POST — legacy basics-only roots                        | **201** accept                            |
| 4   | POST — explicit `schemaVersion` mismatch               | **400** `SCHEMA_VERSION_MISMATCH`         |
| 5   | POST — partial legacy `data`                           | **400** `VALIDATION_FAILURE`              |
| 6   | POST — explicit empty `data` object                    | **400** `VALIDATION_FAILURE`              |
| 7   | POST — missing required plugin fields                  | **400** `VALIDATION_FAILURE`              |
| 8   | POST — invalid `schemaVersion` type (Zod)              | **400** `ZOD_VALIDATION_FAILED`           |
| 9   | PATCH — merge + validation gate (code parity)          | **400** or **200** (inferred)             |
| 10  | GET — read stored legacy canonical                     | **200** no gate                           |
| 11  | Service — `writeTour` default-fill                     | Success (no HTTP)                         |
| 12  | Service — `writeTour` partial legacy                   | `ValidationFailure` → **400** when mapped |
| 13  | Pre-TX gate — mismatch before TX                       | Blocks outbox enqueue                     |
| 14  | Error interceptor — typed `SchemaVersionMismatchError` | **400** stable code                       |

### Schema drift findings

| ID          | Severity | Finding                                                                | Exists today                            | Gap / recommendation                                                   |
| ----------- | -------- | ---------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------------------- |
| **SV-F-01** | Pass     | **POST legacy payloads never 500** in contract spec                    | `assertNotInternalError` in every case  | —                                                                      |
| **SV-F-02** | Pass     | **`SchemaVersionMismatchError` → 400** before saga TX                  | `error-interceptor.ts` typed branch     | —                                                                      |
| **SV-F-03** | Medium   | **No PATCH HTTP cases** in schema-version-compat                       | PATCH uses same gate as POST            | Add PATCH rows mirroring SV-01, SV-05, SV-09                           |
| **SV-F-04** | Medium   | **No `migrateCanonical` on write path** — explicit mismatch only       | `migrate-canonical-hook.ts` placeholder | Phase 6 MAP §8.3; until then old explicit versions reject with **400** |
| **SV-F-05** | Info     | **`LegacyCanonicalAdapter`** is anti-dual-write stub, not read bridge  | Empty mirror; `writeLegacyTour` throws  | Phase 6 legacy read bridge separate concern                            |
| **SV-F-06** | Info     | Omitted `schemaVersion` tracks **workspace current**, not client epoch | `?? currentSchemaVersion` in validation | Document ops expectation on workspace bump                             |
| **SV-F-07** | Low      | Malformed JSON on POST/PATCH → **500**                                 | `JSON.parse` in routes                  | Optional **400** parse envelope (SV-11)                                |

### Prove commands (schema drift)

```bash
cd apps/api
export STORAGE_DRIVER=memory NODE_ENV=test

node --import tsx --test \
  test/4-integration/schema-version-compat.spec.ts \
  test/integration.routes.spec.ts \
  src/tours/create-tour.schema.spec.ts
```

Cross-check error mapping: `test/2-observability/error-enrichment.spec.ts` (in-process enrichment only; HTTP body per phase2 ERR-400-03).

---

## Clock skew — time-travel risks

**Pass (auth):** 2026-06-05 · **Partial (forensics):** mixed timestamp authorities in one canonical TX  
**Spec:** [`clock-skew-resilience.spec.ts`](../test/4-integration/clock-skew-resilience.spec.ts) (CLK-SKEW-01…09)

### Timestamp authority matrix

| Surface                                  | Authority                                           | Skew impact                                                        |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| JWT / dev bearer `exp`                   | App wall clock + **5s** `clockTolerance`            | CLK-SKEW-04…07 — expired tokens **401**; within tolerance **pass** |
| Tour `created_at` on persist             | App `new Date()` in `atomic-canonical-tour-persist` | CLK-SKEW-08 — may disagree with audit/outbox DB `now()`            |
| Audit `occurredAt` / outbox `created_at` | Postgres `@default(now())`                          | DB authority — CLK-SKEW-08/09                                      |
| In-process bus `occurredAt`              | App `new Date().toISOString()` default              | CLK-TT-02 — can lead relay `occurredAt` when not overridden        |
| Relay publish `occurredAt`               | Outbox row `created_at` (DB ISO)                    | CLK-SKEW-09 — **pass** on relay path                               |

**`clock_skew_auth_verdict=pass`** · **`time_travel_forensic_risk_count=4`** (CLK-F-01…04)

### Adversarial scenarios

| ID            | Condition                                      | Outcome                                                    | Cascade link                                   |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| **CLK-TT-01** | App clock ±5 min during `POST /tours`          | Tour timestamp follows **app**; audit/outbox follow **DB** | Forensic ordering wrong; does not block commit |
| **CLK-TT-02** | Relay disabled; in-process subscriber          | `occurredAt` from app clock, not DB row                    | Downstream analytics skew                      |
| **CLK-TT-03** | Mark `done` / idempotency terminal             | App `new Date()` vs row `created_at`                       | Ops dashboards show false lag                  |
| **CLK-TT-04** | Integration spec uses ±5 **min**, not ±5 **s** | JWT budget under-tested at product tolerance               | CLK-F-04                                       |

**Chaos note:** Clock skew does **not** directly trigger [CASCADE-01](#cascade-01--bulk-import-noisy-neighbor-platform-brownout) but corrupts incident timelines when combined with [FOF-LOG-03](phase3-scalability-stress-audit.md#115-fatal-observability-flaw-inventory) tail loss on SIGTERM.

### Prove commands (clock skew)

```bash
cd apps/api
export STORAGE_DRIVER=memory NODE_ENV=test

node --import tsx --test --test-concurrency=1 \
  test/4-integration/clock-skew-resilience.spec.ts
```

---

## Bulk import — RuleEngine coupling

**Verdict:** **RLS pass** · **noisy-neighbor fail** — partition integrity proven; victim SLO **not** gated  
**Spec:** [`bulk-import-consistency.spec.ts`](../test/4-integration/bulk-import-consistency.spec.ts) (BULK-IMPORT-01)

No dedicated `/bulk-import` HTTP route exists. Bulk mode is simulated via direct `persistNewTourAtomically` (10 parallel per chunk, 100 tours per tenant) — **bypasses** HTTP rate limits and [`TENANT_RATE_LIMIT_*`](../src/middleware/tenant-rate-limiter.ts) enforcement.

| ID          | Scenario                                                 | RLS / partition                                        | Availability / NN                                                                                                                                                                                    |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **BULK-01** | Tenant A + B interleaved 100×100 persist                 | **Pass** — BULK-IMPORT-01; no cross-tenant marker leak | **Fail** — no victim SLO under A-only storm ([NN-01](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register), [SCAL-DEBT-13](phase3-scalability-stress-audit.md#scalability-debt)) |
| **BULK-02** | Sustained `POST /tours` at per-tenant write cap (50 RPS) | RLS holds per request                                  | Tenant B **503** / timeout when A holds pool + CPU ([NN-02](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register))                                                               |
| **BULK-03** | Deep validation queue during import                      | Per-tenant gate (HT-03)                                | Unbounded `tenantQueues` → OOM risk ([SCAL-HF-04](phase3-scalability-stress-audit.md#hard-fail-risks))                                                                                               |

**Integration:** Bulk writes enqueue outbox `pending` at the same rate as HTTP creates — relay competes for admin pool ([NN-06](phase3-scalability-stress-audit.md#noisy-neighbor-vulnerability-register)). Rule Engine CPU starvation is the primary [CASCADE-01](#cascade-01--bulk-import-noisy-neighbor-platform-brownout) driver; see [§ Rule Engine hard-fail](#graceful-degradation-audit--rule-engine-hard-fail) for validation hard-fail (no reactive `basic` on engine throw).

### Prove commands (bulk import)

```bash
cd apps/api
export DATABASE_URL="postgresql://app_tour:app_tour@127.0.0.1:5434/tour_db"
export DATABASE_URL_ADMIN="postgresql://postgres:postgres@127.0.0.1:5434/tour_db"
export STORAGE_DRIVER=prisma NODE_ENV=test

node --import tsx --test test/4-integration/bulk-import-consistency.spec.ts
```

---

## Audit metadata

| Field                                           | Value                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auditor                                         | Phase 4 resilience chaos capstone (adversarial synthesis + integration contract review)                                                                                                                                                                                                      |
| **Resilience score**                            | **62 / 100**                                                                                                                                                                                                                                                                                 |
| **Chaos verdict**                               | **CONDITIONAL**                                                                                                                                                                                                                                                                              |
| **Cascading failure scenarios**                 | **CASCADE-01** (noisy-neighbor brownout), **CASCADE-02** (deploy zombies), **CASCADE-03** (rate-limiter + Redis)                                                                                                                                                                             |
| Zombie risk count                               | **6** (OZ-01 … OZ-06)                                                                                                                                                                                                                                                                        |
| Shutdown gap count                              | **7** (SD-G1 … SD-G7); `main.ts` static gaps **0**                                                                                                                                                                                                                                           |
| Orphaned TX risk (SIGTERM)                      | **no**                                                                                                                                                                                                                                                                                       |
| Orphaned TX risk (SIGKILL)                      | **yes** (OZ-A / TX-04 class)                                                                                                                                                                                                                                                                 |
| Data Integrity Breach count (1h backlog replay) | **0** ([§ Consumer down 1h](#consumer-down-1h--backlog-replay-and-ordering))                                                                                                                                                                                                                 |
| FIFO guaranteed per tenant (production relay)   | **no**                                                                                                                                                                                                                                                                                       |
| Recovery verdict                                | **Partial** (atomic + idempotent + SIGTERM drain pass; relay reclaim + shutdown flush + per-tenant FIFO gaps)                                                                                                                                                                                |
| Outbound third-party HTTP call count            | **1** (PI-01 `TenantHttpProxy.fetch`)                                                                                                                                                                                                                                                        |
| Proxy systemic risk count                       | **1** (PI-01 — no timeout / breaker / abort)                                                                                                                                                                                                                                                 |
| Race-condition risk count (feature flags)       | **7** (FF-RC-01 … FF-RC-07)                                                                                                                                                                                                                                                                  |
| Partial update risk count (hot-reload)          | **6** (PU-01 … PU-06)                                                                                                                                                                                                                                                                        |
| Atomic update paths (DB write)                  | **yes** — `create` / `update` / `upsert` single statement                                                                                                                                                                                                                                    |
| Atomic update paths (E2E hot-reload)            | **no** — cache + split readers                                                                                                                                                                                                                                                               |
| Flag sources                                    | Postgres `theme.featureFlags.advancedRuleEngine`; Postgres `theme.rateLimitRps` / `theme.featureFlags.rateLimitRps`; static `DEV_TENANTS`; default constant; env `TENANT_RATE_LIMIT_*`; env `DATABASE_URL` / `NODE_ENV`; env `P5_VALIDATION_ENGINE_CACHE_SIZE`; `tenant-registry-cache` (5s) |
| Rule Engine hard-fail count                     | **16** (HF-RE-01 … HF-RE-16)                                                                                                                                                                                                                                                                 |
| Rule Engine degradation path count              | **2** (GD-RE-01, GD-RE-02)                                                                                                                                                                                                                                                                   |
| Schema drift critical failure count             | **0** ([§ Schema drift — critical failure definition](#critical-failure-definition-this-pass))                                                                                                                                                                                               |
| Schema drift graceful paths count               | **14**                                                                                                                                                                                                                                                                                       |
| Clock skew auth verdict                         | **pass** (CLK-SKEW-04…07)                                                                                                                                                                                                                                                                    |
| Time-travel forensic risks                      | **4** (CLK-F-01 … CLK-F-04)                                                                                                                                                                                                                                                                  |
| Bulk import RLS verdict                         | **pass** (BULK-IMPORT-01)                                                                                                                                                                                                                                                                    |
| Bulk import NN verdict                          | **fail** (no victim SLO spec)                                                                                                                                                                                                                                                                |
| Document                                        | `apps/api/docs/phase4-resilience-audit.md`                                                                                                                                                                                                                                                   |

Architect, documentation status: Updated. Link to docs: `apps/api/docs/phase4-resilience-audit.md`.
