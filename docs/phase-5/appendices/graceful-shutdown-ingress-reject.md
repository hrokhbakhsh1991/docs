# Graceful shutdown HTTP ingress reject (DEC-101 / RB-GAP-09)

```yaml
status: implemented
phase: 5 evolution — P1 Phase 2
closes: RB-GAP-09, RB-GAP-08 (partial)
related: graceful-shutdown-http-watchdog.md DEC-085
```

## Problem

`shuttingDown` was checked only on `GET /health`. New tour writes and other routes could still be accepted after SIGTERM while the relay had stopped — violates drain contract ([RB-GAP-09](phase5-evolution-audit.md)).

## Decision

| Item       | Choice                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------- |
| Gate       | `createRequestListener` — before `dispatchRequest`, if `isGracefulShutdownInProgress()` → **503** |
| Body       | `{ status: "shutting_down", service: "@apps/api" }` — same shape as health                        |
| Connection | `Connection: close` on reject (optional hint for clients)                                         |

## K8s grace period (RB-GAP-08)

| Setting                         | Recommendation                                                                           |
| ------------------------------- | ---------------------------------------------------------------------------------------- |
| `terminationGracePeriodSeconds` | **≥ 30s** (not a 30s rollback target — minimum drain budget)                             |
| `preStop`                       | Sleep **2–5s** then SIGTERM so load balancer stops sending                               |
| Env                             | `GRACEFUL_SHUTDOWN_HTTP_MS` default **10s**; `GRACEFUL_SHUTDOWN_FLUSH_MS` default **8s** |

Documented in [`production-deploy-checklist.md`](../../phase-4/production-deploy-checklist.md) § Bad deployment rollback.

## Verification

```bash
cd apps/api && pnpm run guard:shutdown-ingress
node --import tsx --test src/http/shutdown-ingress.spec.ts
```
