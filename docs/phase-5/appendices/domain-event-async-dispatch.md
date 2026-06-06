# Domain event async dispatch (DEC-071 / OB-COND-01)

```yaml
status: implemented
phase: 3 scalability audit — HF-12 / OB-COND-01
closes: SCAL-HF-12, OB-COND-01 (relay hot path)
related: IMPLEMENTATION-DECISIONS.md DEC-004, phase4-resilience-audit OZ-02
package: packages/platform-events
```

## Problem

`publishDomainEvent` used Node `EventEmitter.emit`, which invokes every subscriber **synchronously** on the same event-loop turn. A heavy or CPU-bound handler blocks:

- Outbox relay (`publishClaimedOutboxRow`) before `markOutboxDoneWithRetry`
- HTTP paths that still call `publishTourCreatedEvent` on memory storage
- Co-located relay tick + HTTP under 10k flood (§10 OB-COND-01)

This is a **System Scalability Failure** risk when subscribers grow beyond trivial projection hooks — not observed @ 10k measured load, but architecturally fatal on a single worker.

## Decision

Defer subscriber invocation to the **next event-loop phase** via `setImmediate` inside `wrapHandler` (`packages/platform-events/src/bus.ts`).

| Property                         | Before                           | After                                       |
| -------------------------------- | -------------------------------- | ------------------------------------------- |
| `publishDomainEvent` return      | After sync handlers finish       | After handlers are **scheduled**            |
| Outbox `markOutboxDone` ordering | After sync handlers              | After schedule (unchanged pairing contract) |
| Duplicate `eventId` dedupe       | Sync in wrapper                  | Sync before schedule (same turn as publish) |
| Async handlers                   | `void handler()` fire-and-forget | Same, on next tick                          |
| Sync heavy handlers              | Block publisher                  | Block next tick, not relay publish call     |

```mermaid
sequenceDiagram
  participant Relay as outbox-relay
  participant Bus as publishDomainEvent
  participant Loop as event loop
  participant Sub as subscriber

  Relay->>Bus: publishDomainEvent(envelope)
  Bus->>Bus: dedupe + schedule setImmediate per handler
  Bus-->>Relay: return envelope
  Relay->>Relay: markOutboxDoneWithRetry
  Loop->>Sub: handler(envelope)
```

## Non-goals

- **Worker threads** for subscribers — deferred; handlers must stay light or use their own queue.
- **Cross-process bus** — outbox + relay remains the durability boundary (DEC-004).
- **Awaiting handler completion before mark done** — would widen OZ-02 window and slow relay; idempotency is handler-side (`processed_domain_events`, DEC-039).

## API surface

| Export                               | Role                                   |
| ------------------------------------ | -------------------------------------- |
| `publishDomainEvent`                 | Unchanged signature; dispatch deferred |
| `flushDomainEventDispatch()`         | Test helper — one `setImmediate` turn  |
| `subscribeDomainEvent` / `ForTenant` | Unchanged                              |

## Handler budget monitor (OB-COND-01 residual)

Deferral alone does not cap CPU on the next tick. See [domain-event-handler-monitor.md](domain-event-handler-monitor.md) — `DOMAIN_EVENT_HANDLER_BUDGET_MS` (default **10**) increments `domain_event_handler_slow_total` when a subscriber exceeds budget.

## Verification

```bash
cd packages/platform-events && pnpm test
cd apps/api && pnpm exec tsc -p tsconfig.json
node --import tsx --test packages/platform-events/test/events.spec.ts
node --import tsx --test packages/platform-events/test/handler-monitor.spec.ts
node --import tsx --test apps/api/src/outbox/outbox-publish-done-pairing.spec.ts
node --import tsx --test apps/api/test/1-reliability/domain-event-consistency.spec.ts
pnpm run guard:domain-event-async-dispatch  # apps/api
pnpm run guard:domain-event-handler-monitor  # apps/api
```

**Acceptance:** Spec proves sync subscriber work does not run before `publishDomainEvent` returns; outbox pairing spec still passes (mark `done` after publish call).
