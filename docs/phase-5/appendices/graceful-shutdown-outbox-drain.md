# Graceful shutdown — relay await + flush timeout (DEC-076 / Phase 4 step 6)

```yaml
status: implemented
phase: 4 resilience audit — closure step 6
closes: SD-G2, SD-G3, F-11, F-12 (partial)
related: outbox-processing-reclaim.md (DEC-071), phase4-resilience-audit.md
```

## Problem

| Gap       | Issue                                                                                                                                            |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **SD-G2** | `outboxRelay.stop()` cleared the poll timer but did **not** await an in-flight `processOutboxRelayOnce` tick                                     |
| **SD-G3** | `drainOutboxRelayOnShutdown` returned silently when `GRACEFUL_SHUTDOWN_FLUSH_MS` expired — process could **exit 0** with pending/processing rows |

## Decision

| Item           | Choice                                                                                  |
| -------------- | --------------------------------------------------------------------------------------- |
| Relay stop     | `OutboxRelayHandle.stop(): Promise<void>` — `clearInterval` then `await` in-flight tick |
| Drain result   | `OutboxShutdownDrainResult { drained, pending, activeProcessing }`                      |
| Timeout signal | `GracefulShutdownOutboxFlushTimeoutError` → `runGracefulShutdown` throws → **exit 1**   |
| Metric         | `graceful_shutdown_outbox_flush_timeout_total`                                          |
| Log            | `graceful_shutdown.outbox_flush_timeout` with pending/processing counts                 |

## Shutdown order (DEC-076 + DEC-085)

1. `await outboxRelay.stop()` — no new ticks; in-flight tick completes (**SD-G2**)
2. `GET /health` → **503** while shutting down (K8s preStop pattern)
3. `closeHttpServerWithWatchdog` — `GRACEFUL_SHUTDOWN_HTTP_MS` cap (**SD-G4**)
4. `drainHttpRequestLogQueueSync` + `await flushLogSink` (**SD-G5**)
5. `drainOutboxRelayOnShutdown` — reclaim + relay until quiescent or deadline (**SD-G3**)

See [`graceful-shutdown-http-watchdog.md`](graceful-shutdown-http-watchdog.md).

## Verification

```bash
cd apps/api && pnpm run guard:graceful-shutdown-outbox
node --import tsx --test src/server/graceful-shutdown-outbox.spec.ts
node --import tsx --test src/outbox/start-outbox-relay.spec.ts
```
