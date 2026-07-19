# Finance reconciliation foundation — implementation

```yaml
doc_id: FINANCE_RECONCILIATION_FOUNDATION
version: "1.1"
date: "2026-07-19"
status: implemented_foundation
authority: FINANCE_RECONCILIATION_DESIGN.md
constraints:
  - no payment state machine changes
  - no ledger domainEventId / journalId formula changes
  - no approveManualReceiptAtomic / Option C TX changes
  - detect is read-only (admin Prisma SELECT + findings upsert)
```

## Delivered (v1 foundation)

| Capability | Module |
| ---------- | ------ |
| Findings + actions tables | `finance_recon_findings`, `finance_recon_actions` (+ Prisma models) |
| Detection rules R1–R6 | `apps/api/src/workspace-finance/recon/detect.ts` |
| Job runner (batched lookback) | `finance-recon-runner.ts` — R1 includes no-ledger + amt mismatch + dup capture |
| Interval starter | `start-finance-recon.ts` (`FINANCE_RECON_ENABLED`; default on with prisma+`DATABASE_URL`) |
| Metrics | `finance_recon_findings_open` gauge after scan; `finance_recon_repair_total{action,result}` |
| Ops HTTP | `GET/POST /internal/finance/recon/*` (ops JWT `metrics:read` in prod) |
| Repair (allowlisted) | dry-run default; apply `D-PAID-NO-LEDGER` (same capture id enqueue), `D-PAID-BOOKING-DRIFT` (`BookingPaymentAdapter.syncStatus`), `ignore` |
| Auto-repair | only when `FINANCE_RECON_AUTO_REPAIR=1` after scan (allowlisted codes only) |
| Audit | every repair/ignore → `finance_recon_actions` + `finance.recon.*` pino |

### Detection coverage

| Code | Job | Detect | Repair apply |
| ---- | --- | ------ | ------------ |
| `D-PAID-NO-LEDGER` | R1 | yes | yes (enqueue same capture id) |
| `D-PAID-AMT-MISMATCH` | R1 | yes (debit sum vs `payments.amount`; malformed → finding) | no |
| `D-DUP-CAPTURE` | R1 | yes (`COUNT(*)>1` same capture domainEventId) | no |
| `D-PREPAY-NO-LEDGER` | R2 | yes | no |
| `D-PAID-BOOKING-DRIFT` | R3 | yes | yes (booking sync only) |
| `D-PREPAY-BOOKING-DEGRADED` | R4 | yes | no (existing degraded retry API separate) |
| `D-OUTBOX-FAILED` / `D-OUTBOX-STALE` / `D-STUCK-PENDING` | R5 | yes | no |
| `D-DOUBLE-WALLET` | R6 | yes (info) | no |

## Fingerprint

`UNIQUE (tenant_id, code, fingerprint)` — re-scans upsert open findings; previously resolved/ignored rows **reopen** when the same fingerprint is detected again.

## Remaining gaps

| Gap | Notes |
| --- | ----- |
| True compensating reverse journals | Ticket path only (`ticket_only` / human GL) |
| Operator product UI | Settings stub may exist; not bound to findings API |
| Cross-region multi-primary | Single-DB assumption |
| Receipt-state divergence rule | Design mentions receipts; no dedicated detector yet |

Repair engine: see [`FINANCE_RECON_REPAIR_ENGINE.md`](./FINANCE_RECON_REPAIR_ENGINE.md).

## Env

| Var | Default |
| --- | ------- |
| `FINANCE_RECON_ENABLED` | on when `STORAGE_DRIVER=prisma` + `DATABASE_URL` |
| `FINANCE_RECON_INTERVAL_MS` | `300000` (5m) |
| `FINANCE_RECON_LOOKBACK_MS` | `604800000` (7d) — shared with gauge |
| `FINANCE_RECON_BATCH_SIZE` | `500` |
| `FINANCE_RECON_AUTO_REPAIR` | off |
| `FINANCE_RECON_STALE_OUTBOX_MS` | `300000` |

## HTTP

| Method | Path |
| ------ | ---- |
| `GET` | `/internal/finance/recon/findings?tenantId=&code=&limit=` |
| `GET` | `/internal/finance/recon/findings/:id` |
| `GET` | `/internal/finance/recon/repair-matrix` |
| `POST` | `/internal/finance/recon/findings/:id/repair` `{ mode?, reason?, approvedConfirm?, dryRun?, action?, actorUserId? }` |
| `POST` | `/internal/finance/recon/run` `{ job?: "R1"\|…\|"ALL", tenantId? }` |
