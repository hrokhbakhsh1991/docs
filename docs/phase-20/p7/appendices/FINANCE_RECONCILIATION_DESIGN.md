# Finance reconciliation capability — minimal production design

```yaml
doc_id: FINANCE_RECONCILIATION_DESIGN
version: "1.0"
date: "2026-07-19"
status: foundation_implemented
constraints:
  - do not modify approve atomicity (Option C TX)
  - do not change ledger domainEventId / journalId formulas
  - use existing architecture (host Prisma, outbox, FinanceService ports, Phase 3.7 gauges)
```

## Goal

Detect and repair **divergence** among:

| Source | Store |
| ------ | ----- |
| Payment state | `payments` |
| Receipt state | `payment_receipts` |
| Ledger entries | `outbox_events` (`finance.ledger.double_entry_applied`) |
| Prepayments | `outbox_events` (`finance.prepayment.recorded` + ledger sibling) |
| Booking payment state | `operator_registrations.payment_status` (via booking port) |
| Outbox delivery | `outbox_events.status` (`pending` / `failed` / `processing`) |

**Non-goals:** redesign approve TX; new ledger identity; reverse-journal product UI; full GL subledger tables.

---

## Architecture placement

```text
[Scheduler / scrape tick]
        │
        ▼
 finance-recon.job (apps/api)     ← admin Prisma reads only for detect
        │
        ├─► findings → finance_recon_findings (new, host-owned)
        ├─► gauges   → existing metricsRegistry (Phase 3.7)
        └─► repair   → gated ops actions (see §3)
                │
                ├─ enqueue missing capture (SAME domainEventId)
                ├─ outbox failed → pending (existing replay primitive)
                └─ booking sync retry (existing FinanceService / prepay retry)
```

No calls into `approveManualReceiptAtomic`. No `FinanceService` money-path mutation for Paid→Pending.

---

## 1. Reconciliation jobs

| Job | Schedule | Scope | Output |
| --- | -------- | ----- | ------ |
| **R1 Paid↔Ledger** | every 5m (or metrics scrape + cron) | `paid_at` within lookback (default **7d**, configurable) | findings + `finance_reconciliation_mismatch` |
| **R2 Prepay↔Ledger** | every 5m | `finance.prepayment.recorded` without sibling `…:ledger` domainEventId | findings |
| **R3 Paid↔Booking** | every 15m | Paid payment whose registration booking `paymentStatus ≠ paid` | findings |
| **R4 Prepay↔Booking** | every 15m | Open `finance.prepayment.booking_sync.degraded` (existing list) | findings + reuse degraded API |
| **R5 Outbox health** | every 5m | finance.* pending age / failed count | gauges (extend Phase 3.7) |
| **R6 TourCreated∩Capture** | daily | same `registrationId` with both TourCreated ledger + payment capture (informational) | findings `severity=info` (no auto-repair) |

**Implementation sketch:** one worker module `apps/api/src/workspace-finance/finance-recon-runner.ts`, invoked from relay tick **or** dedicated interval (same pattern as projection auto-reconcile). Batched SQL with `LIMIT` / keyset on `paid_at` for 1M scale.

---

## 2. Detection rules

| Code | Predicate | Severity |
| ---- | --------- | -------- |
| **D-PAID-NO-LEDGER** | `payments.status=Paid` AND no outbox row `domain_event_id = payment:{paymentId}:ledger-capture-anchor` AND `event_type = finance.ledger.double_entry_applied` | critical |
| **D-PAID-AMT-MISMATCH** | Paid + capture exists AND sum(debit lines) ≠ `payments.amount` (same currency) | critical |
| **D-DUP-CAPTURE** | >1 outbox row with same capture `domain_event_id` (should be impossible under unique) OR >1 capture payload for same paymentId with different journalIds | critical |
| **D-PREPAY-NO-LEDGER** | `finance.prepayment.recorded` exists AND no `domain_event_id = {prepaymentDomainEventId}:ledger` | critical |
| **D-PAID-BOOKING-DRIFT** | Paid payment AND booking `paymentStatus` not `paid` (and booking row exists) | high |
| **D-PREPAY-BOOKING-DEGRADED** | open degraded event without recovered | medium |
| **D-OUTBOX-FAILED** | finance.* `status=failed` | high |
| **D-OUTBOX-STALE** | finance.* pending age > SLO (e.g. 300s) | medium |
| **D-STUCK-PENDING** | `Payment` Pending > 24h | medium |
| **D-DOUBLE-WALLET** | TourCreated ledger + payment capture both present for same registration (both credit booking wallet) | info / policy |

Stable capture id formula is **unchanged**: `payment:{paymentId}:ledger-capture-anchor`.

---

## 3. Repair workflow

### Principles

1. **Never** alter approve TX / reopen Paid as Pending.  
2. **Never** mint a new capture `domainEventId` or journalId for an existing payment — rebuild plan must use **existing** payment id → same stable ids from workspace ledger policy.  
3. Repair is **idempotent**: insert outbox only if missing (`ON CONFLICT DO NOTHING` / unique on `(tenantId, domainEventId)`).  
4. Auto-repair only for **safe, deterministic** cases; else queue for operator.

### Auto-repair allowlist (v1)

| Finding | Auto? | Action |
| ------- | ----- | ------ |
| D-PAID-NO-LEDGER | **Yes** (feature flag `FINANCE_RECON_AUTO_REPAIR=1`) | Load payment + approved receipt; call workspace `buildPaymentCaptureJournal` with payment fields; `enqueueFinanceLedgerCaptureOutbox` with **existing** plan ids; write audit |
| D-PREPAY-NO-LEDGER | **No** (v1) | Operator: rebuild from recorded payload + `buildPrepaymentJournal` with **same** `ledgerDomainEventId` |
| D-PAID-BOOKING-DRIFT | **Yes** (flag) | `bookingPayments.syncStatus({ paymentStatus: "paid" })` only — not approve TX |
| D-PREPAY-BOOKING-DEGRADED | **Yes** | Existing `retryPrepaymentBookingSync` |
| D-OUTBOX-FAILED | **No** | Ops replay after poison fix (DEC-086 prod path) |
| D-PAID-AMT-MISMATCH / D-DUP-CAPTURE / D-DOUBLE-WALLET | **No** | Human + ticket only |

### Manual repair sequence (Paid missing ledger)

```text
1. Confirm finding D-PAID-NO-LEDGER (payment Paid, receipt Approved).
2. Dry-run: build capture plan; assert domainEventId == payment:{id}:ledger-capture-anchor.
3. Apply: enqueue outbox (same id); do not touch payments/receipts rows.
4. Audit row: repaired / actor / finding_id.
5. Re-run R1 for tenant; finding → resolved.
```

---

## 4. Audit trail

New host table (minimal):

```text
finance_recon_findings
  id, tenant_id, code, severity, status (open|resolved|ignored)
  payment_id?, registration_id?, outbox_event_id?
  details jsonb, detected_at, resolved_at, resolved_by?

finance_recon_actions
  id, finding_id, tenant_id, action (enqueue_capture|booking_sync|replay_outbox|ignore)
  actor_user_id, dry_run bool, result (ok|conflict|error), payload jsonb, created_at
```

- Append-only actions.  
- Emit structured log `finance.recon.*` via existing `HostFinanceLogAdapter` / pino.  
- Metric: `finance_recon_findings_open`, `finance_recon_repair_total{action,result}`.

No finance-core changes required for audit storage (host-owned).

---

## 5. Manual operator tools

| Tool | Surface | Auth |
| ---- | ------- | ---- |
| List open findings | `GET /internal/finance/recon/findings?tenantId=&code=` | Ops JWT (metrics/recon scope) |
| Get finding | `GET /internal/finance/recon/findings/:id` | Ops JWT |
| Dry-run repair | `POST /internal/finance/recon/findings/:id/repair` `{ "dryRun": true }` | Ops JWT + dual-control flag in prod |
| Apply repair | same, `dryRun: false` | Ops JWT + allowlisted actions only |
| Trigger scan | `POST /internal/finance/recon/run` `{ "job": "R1", "tenantId?" }` | Ops JWT |
| Existing | `GET /finance/prepayments/booking-sync-degraded` + retry | Operator session (already) |
| Existing | Outbox replay | Extend DEC-086 for prod with ops JWT |

Operator **product UI** (optional v1.1): reuse finance command-center “reconciliation triage” settings stub — bind to findings API; not required for production-operable v1 if internal ops HTTP + alerts exist.

---

## Rollout

| Phase | Deliver |
| ----- | ------- |
| **v1 detect** | R1–R5 jobs + findings table + gauges/alerts (extend `FinanceReconciliationMismatch`) |
| **v1 repair** | Flagged auto D-PAID-NO-LEDGER + booking sync; internal repair HTTP dry-run/apply |
| **v1.1** | Prepay ledger repair; R6 double-wallet report; operator UI list |

---

## Acceptance (production-ready bar)

1. D-PAID-NO-LEDGER detected within one job interval and paged.  
2. Repair inserts **exactly** `payment:{id}:ledger-capture-anchor` when missing; second apply is no-op.  
3. Approve path code/tests unchanged.  
4. Every repair writes `finance_recon_actions`.  
5. Lookback + batching safe at ~1M payments (no full-table scan per tick).

---

## Related

- [`FINANCE_OPS_HARDENING.md`](./FINANCE_OPS_HARDENING.md)  
- [`FINANCE-OPS-RUNBOOK.md`](./FINANCE-OPS-RUNBOOK.md)  
- [`FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md`](./FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md)
