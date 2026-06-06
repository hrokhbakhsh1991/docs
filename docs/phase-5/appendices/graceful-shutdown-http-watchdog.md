# Graceful shutdown HTTP watchdog + log flush order (DEC-085 / Wave B)

```yaml
status: implemented
phase: 4 resilience — Wave B
closes: SD-G4, SD-G5, SD-G7
related: graceful-shutdown-outbox-drain.md (DEC-076)
```

## Problem

| Gap       | Issue                                                               |
| --------- | ------------------------------------------------------------------- |
| **SD-G4** | `server.close` unbounded when keep-alive / hung handler blocks exit |
| **SD-G5** | Log tail may be lost if flush order wrong relative to outbox drain  |
| **SD-G7** | Integration worker duplicated shutdown logic; SIGINT not registered |

## Decision

### Shutdown order (DEC-085)

1. `await outboxRelay.stop()`
2. `shuttingDown = true` → `GET /health` returns **503** `shutting_down`
3. `closeHttpServerWithWatchdog(server)` — `closeIdleConnections()` then race `server.close` vs `GRACEFUL_SHUTDOWN_HTTP_MS`
4. On HTTP timeout: `closeAllConnections()` + `graceful_shutdown_http_force_close_total` → **exit 1**
5. `drainHttpRequestLogQueueSync()`
6. `await flushLogSink()`
7. `drainOutboxRelayOnShutdown` + `disconnectPrisma`

### Env

| Variable                     | Default | Role                   |
| ---------------------------- | ------- | ---------------------- |
| `GRACEFUL_SHUTDOWN_HTTP_MS`  | `10000` | Hard cap on HTTP drain |
| `GRACEFUL_SHUTDOWN_FLUSH_MS` | `8000`  | Outbox flush (DEC-076) |

### Worker parity (SD-G7)

`test/4-integration/graceful-shutdown-worker.ts` uses `installGracefulShutdownHandlers` from `graceful-shutdown.ts` — **SIGTERM + SIGINT**, no duplicate drain logic.

## Verification

```bash
cd apps/api && pnpm run guard:graceful-shutdown-outbox
node --import tsx --test src/server/graceful-shutdown-http-watchdog.spec.ts
```
