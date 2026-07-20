# TODO-011 — Capability / lifecycle grading cleanup

```yaml
doc_id: BOOKING_REMEDIATION_TODO_011_CAPABILITY_GRADE
status: ACTIVE
date: "2026-07-20"
severity: P2
```

## Problem

Docs still graded `eventReaction` as **ACTIVE in-process** while Option A disabled the hollow claim (`enabled=false`, `mode=none`). Lifecycle tables still implied `reactAfterApprove` on every approve.

## Fix

| Surface | Grade |
| ------- | ----- |
| `eventReaction` in-process | **OFF** (Denali + booking-ws2) — Option A |
| Approve durability | **Host outbox** only (`registration.approved`) |
| Adapter binding | Retained for `approveOutboxEventType` only |
| `invokeApproveReaction` | No-op unless capability `enabled` + `mode=in-process` |

## Code / proof

- Service guard already skips reaction when graded off.
- Specs updated: `booking-event-ownership.spec.ts`, `booking-approve-reaction-delivery.spec.ts` expect **0** in-process calls on approve.
- Registry audit + lifecycle + maturity docs graded to match.
