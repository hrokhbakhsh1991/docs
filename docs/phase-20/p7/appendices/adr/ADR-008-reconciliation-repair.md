# ADR-008 — Reconciliation detect and repair

```yaml
adr_id: ADR-008
title: Finance reconciliation and repair
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - FINANCE_RECONCILIATION_DESIGN
  - FINANCE_RECONCILIATION_FOUNDATION
  - FINANCE_RECON_REPAIR_ENGINE
  - ADR-001
  - ADR-007
  - ADR-011
```

## Status

Accepted (foundation + repair engine implemented).

## Context

Production needs detection and controlled repair of Paid↔ledger↔booking↔outbox divergence without changing payment state machines, Option C order, or ledger identity formulas.

## Decision

1. **Detect** R-codes → upsert `finance_recon_findings` with unique `(tenant_id, code, fingerprint)`.
2. **Repair engine** modes: `preview` | `manual` | `approved` | `automatic` (`FINANCE_RECON_AUTO_REPAIR=1` for autoSafe only).
3. **Allowlist matrix** defines per-code actions, modes, `approvedConfirm`, and rollback strategy.
4. Hard constraints:
   - no payment state-machine redesign
   - no `domainEventId` / journalId formula changes
   - no Option C TX redesign
   - **never mint a new capture id** for an existing payment (re-enqueue same anchor)
5. Examples: `D-PAID-NO-LEDGER` → enqueue capture (autoSafe); `D-PREPAY-NO-LEDGER` → rebuild ledger from recorded payload; `D-OUTBOX-FAILED` → ADR-007 replay (approved); amount mismatch / dup capture → `ticket_only`.
6. Every mutate audits `finance_recon_actions` (`mode`, `reason`, `rollback_strategy`, actor).

## Consequences

- True reversing journals remain human/GL work (`ticket_only`).
- Auto-repair is narrow and idempotent where marked autoSafe.
- Integrity docs must stay aligned with the matrix (stale FAIL rows are documentation debt only).

## Evidence

- [`../FINANCE_RECONCILIATION_FOUNDATION.md`](../FINANCE_RECONCILIATION_FOUNDATION.md)
- [`../FINANCE_RECON_REPAIR_ENGINE.md`](../FINANCE_RECON_REPAIR_ENGINE.md)
- `apps/api/src/workspace-finance/recon/*`
