# Finance reconciliation repair engine

```yaml
doc_id: FINANCE_RECON_REPAIR_ENGINE
version: "1.0"
date: "2026-07-19"
status: implemented
authority: FINANCE_RECONCILIATION_DESIGN.md
extends: FINANCE_RECONCILIATION_FOUNDATION.md
constraints:
  - no payment state machine changes
  - no ledger domainEventId / journalId formula changes
  - no approveManualReceiptAtomic / Option C TX changes
  - never mint a new capture id for an existing payment
```

## Modes

| Mode | Mutates? | Requirements | Use |
| ---- | -------- | ------------ | --- |
| **preview** | No | finding id | Default; plan + validation only |
| **manual** | Yes | `reason` (non-empty) + operator | Operator apply without dual-control phrase |
| **approved** | Yes | `reason` + `approvedConfirm: true` + operator | Explicit dual-control for elevated risk |
| **automatic** | Yes | matrix `autoSafe` + `FINANCE_RECON_AUTO_REPAIR=1` | Scanner auto-heal only |

Legacy `dryRun: true` → **preview**; `dryRun: false` without mode → **manual** (still requires `reason`).

## Repair matrix

| Divergence | Code | Action | preview | manual | approved | automatic | Rollback strategy |
| ---------- | ---- | ------ | ------- | ------ | -------- | --------- | ----------------- |
| Paid without ledger | `D-PAID-NO-LEDGER` | Enqueue capture (same `payment:{id}:ledger-capture-anchor`) | yes | yes | yes | **yes** | `none_idempotent_reenqueue` — do not delete payment; duplicate enqueue no-ops |
| Ledger without payment | `D-LEDGER-NO-PAYMENT` | Quarantine orphan capture outbox → `failed` (pending/processing only); done → ticket | yes | no | **yes** | no | `quarantine_orphan_or_ticket` — reopen requires ops replay after root-cause |
| Duplicate ledger | `D-DUP-CAPTURE` | Ticket / ignore only (unique key should prevent) | yes | no | **ack** | no | `ticket_only` — compensating reverse journal is human GL work |
| Missing prepayment ledger | `D-PREPAY-NO-LEDGER` | Rebuild ledger from `finance.prepayment.recorded` payload (same `:ledger` id) | yes | yes | yes | no | `none_idempotent_reenqueue` |
| Outbox divergence (failed) | `D-OUTBOX-FAILED` | Prod replay failed→pending (Phase 3.17 confirm) | yes | no | **yes** | no | `outbox_re_fail` — set status back to `failed` if publish still poison |
| Outbox stale / booking drift / degraded | existing codes | booking sync / replay / retry | yes | yes* | yes* | *per matrix | see handlers |

\* `D-PAID-BOOKING-DRIFT` automatic+manual; `D-PREPAY-BOOKING-DEGRADED` manual/approved via retry port; `D-OUTBOX-STALE` preview+approved replay like failed.

## Audit (every repair)

`finance_recon_actions` columns:

| Field | Source |
| ----- | ------ |
| `actor_user_id` | operator |
| `reason` | required for mutate modes |
| `mode` | preview \| manual \| approved \| automatic |
| `rollback_strategy` | from matrix |
| `created_at` | timestamp |
| `payload` | plan / outcome / compensation hints |
| `dry_run` | true iff preview |
| `result` | ok \| conflict \| error \| noop \| unsupported \| rejected |

Structured log: `finance.recon.repair` with the same fields.

## HTTP

```http
POST /internal/finance/recon/findings/:id/repair
{
  "mode": "preview" | "manual" | "approved" | "automatic",
  "reason": "…",
  "actorUserId": "ops@…",
  "approvedConfirm": true,
  "action": "repair" | "ignore"
}
```

Also: `GET /internal/finance/recon/repair-matrix`

## Modules

| Module | Role |
| ------ | ---- |
| `recon/repair-matrix.ts` | Declarative allowlist |
| `recon/repair-engine.ts` | Mode gate + dispatch + audit |
| `recon/repair-handlers.ts` | Per-code mutations |
| `recon/detect.ts` | + `detectLedgerNoPayment` |
