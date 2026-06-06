# Domain event handler budget monitor (OB-COND-01)

```yaml
status: implemented
phase: 3 scalability audit — OB-COND-01 residual monitor
closes: OB-COND-01 monitor (DEC-071 deferred dispatch + duration budget)
related: domain-event-async-dispatch.md, phase3-scalability-stress-audit.md §10.7
package: packages/platform-events
```

## Problem

`publishDomainEvent` defers handler invocation with `setImmediate` ([domain-event-async-dispatch.md](domain-event-async-dispatch.md)), so relay `markOutboxDone` no longer waits on sync subscriber bodies. **Residual risk:** a plugin subscriber that runs **>10 ms** of CPU or blocking I/O on the next event-loop turn still monopolizes the worker — the audit register **OB-COND-01** required a **monitor**, not only deferral.

## Decision

| Knob                             | Default        | Behavior                                                                                                                |
| -------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `DOMAIN_EVENT_HANDLER_BUDGET_MS` | **10**         | After each handler completes (sync or async), if wall time exceeds budget → increment `domain_event_handler_slow_total` |
| Invalid env                      | fallback 10 ms | Fail-safe                                                                                                               |
| Publish path                     | unchanged      | Budget applies **after** `setImmediate` schedule — publish still returns before handler body                            |

```mermaid
sequenceDiagram
  participant Bus as wrapHandler
  participant Loop as event loop
  participant Mon as handler-monitor
  participant Sub as subscriber

  Bus->>Loop: setImmediate(handler)
  Loop->>Sub: invoke handler
  Sub-->>Loop: return / Promise settle
  Loop->>Mon: recordDomainEventHandlerDuration(type, ms)
  alt ms > budget
    Mon->>Mon: domain_event_handler_slow_total++
  end
```

## Non-goals

- **Rejecting** or **canceling** slow handlers — observability only; operators alert on counter growth.
- **Per-tenant cardinality** on the counter — bounded by `event.type` label in Prometheus export (apps/api bridge).

## Implementation map

| File                                                      | Role                                     |
| --------------------------------------------------------- | ---------------------------------------- |
| `packages/platform-events/src/handler-monitor.ts`         | Budget resolver + slow counter           |
| `packages/platform-events/src/bus.ts`                     | Duration wrap in `setImmediate` callback |
| `apps/api/src/observability/prometheus-format.ts`         | Export `domain_event_handler_slow_total` |
| `apps/api/scripts/guard-domain-event-handler-monitor.mjs` | CI lock                                  |
| `packages/platform-events/test/handler-monitor.spec.ts`   | Budget breach increments counter         |

## Verification

```bash
cd packages/platform-events && pnpm test
cd apps/api && pnpm run guard:domain-event-handler-monitor
cd apps/api && pnpm run guard:domain-event-async-dispatch
```
