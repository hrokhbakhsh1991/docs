# ADR-007 — Outbox failed → pending replay

```yaml
adr_id: ADR-007
title: Outbox failed replay
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - DEC-086
  - OUTBOX_PRODUCTION_REPLAY
  - DEC-110
  - FINANCE_RECON_REPAIR_ENGINE
```

## Status

Accepted (DEC-086 + Phase 3.17 production ops).

## Context

Poison publish leaves outbox rows in terminal `failed`. Automatic reclaim would loop poison. Operators need scoped, audited replay after root-cause fix without mutating payloads.

## Decision

1. **DEC-086:** terminal `failed` + `last_error`; **auto-retry of `failed` is forbidden**.
2. Replay mutation: **`failed` → `pending`**, clear `processed_at` / `last_error`; **payload immutable**.
3. Phase 3.17 production capability:
   - Modes: single / batch / tenant / workspace / date_range
   - Default **dry-run**; apply requires `confirm: true` and `confirmPhrase: "REPLAY"`
   - Prod auth: ops JWT scope `outbox:replay`; non-prod: provisioning-dev gate
   - Audit: `outbox_replay_runs` (+ metrics duration/events)
   - Caps: batch ≤500; scan/apply ≤2000 per run
4. Transient retries **before** terminal failed remain **DEC-110** (unchanged).
5. Finance recon `D-OUTBOX-FAILED` repair delegates to this replay semantics (approved mode).

## Consequences

- Poison fix remains a separate ops/DBA step; replay never rewrites payload.
- Finance runbooks and SLO-F6 cover replay duration/failure.
- Schema/claim/relay redesign is explicitly out of scope.

## Evidence

- [`../../../phase-5/appendices/outbox-failed-replay.md`](../../../phase-5/appendices/outbox-failed-replay.md) (DEC-086)
- [`../OUTBOX_PRODUCTION_REPLAY.md`](../OUTBOX_PRODUCTION_REPLAY.md)
- `apps/api/src/outbox/outbox-prod-replay.ts`
- `apps/api/src/routes/internal/outbox-replay.ts`
