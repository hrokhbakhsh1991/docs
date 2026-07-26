# Finance operations runbook

```yaml
doc_id: FINANCE-OPS-RUNBOOK
version: "1.0"
date: "2026-07-19"
audience: host API on-call + platform infra
related: FINANCE_OPS_HARDENING.md, FINANCE_OPERATIONAL_OWNERSHIP.md
```

## 1. Incident detection

| Symptom | First signal |
| ------- | ------------ |
| Approve broken | `FinanceApproveFailureSpike` / 5xx on `PATCH /finance/receipts/*/review` |
| Ledger missing | `FinanceLedgerCaptureFailure` or `FinanceReconciliationMismatch` |
| Relay stuck | `FinanceOutboxBacklog` and/or `AppTourOutboxRelayLagHigh` |
| Payments aging Pending | `FinanceStuckPayments` |
| DB/storage storm | `AppTourDbCircuitOpen` / MinIO errors in logs `RECEIPT_PROOF_*` |

Pager: severity=critical → host API on-call; escalate platform for Postgres/relay/MinIO.

## 2. Diagnosis

### 2.1 Approve failures

1. Pull logs: `finance.host.*`, `FINANCE_BOOKING_PAYMENT_SYNC_*`, `FINANCE_APPROVE_CONFLICT`.  
2. Confirm booking row exists for `registrationId` (sync miss).  
3. Check idempotency reclaim storms (`HttpIdempotencyRecord` processing).  
4. Metric: `sum by (result, workspace_type) (increase(finance_approve_total[15m]))`.

### 2.2 Paid without ledger

```sql
-- Admin role; bound time window for 1M-scale safety
SELECT p.tenant_id, p.id AS payment_id, p.paid_at, p.ledger_journal_id
FROM payments p
WHERE p.status = 'Paid'
  AND p.paid_at > NOW() - INTERVAL '7 days'
  AND NOT EXISTS (
    SELECT 1 FROM outbox_events o
    WHERE o.tenant_id = p.tenant_id
      AND o.domain_event_id = 'payment:' || p.id::text || ':ledger-capture-anchor'
      AND o.event_type = 'finance.ledger.double_entry_applied'
  )
LIMIT 100;
```

Cross-check gauge `finance_reconciliation_mismatch`.

### 2.3 Outbox / reaction

1. `outbox_events` where `event_type LIKE 'finance.%'` and `status IN ('pending','failed','processing')`.  
2. Reaction failures: `finance_reaction_failed_total` + log `workspace.finance.tour_created_failed`.  
3. Age: `finance_outbox_oldest_pending_age_seconds`.

### 2.4 Stuck payments

```sql
SELECT tenant_id, id, registration_id, status, created_at
FROM payments
WHERE status = 'Pending'
  AND created_at < NOW() - INTERVAL '24 hours'
ORDER BY created_at ASC
LIMIT 100;
```

Join pending receipts on `payment_id`.

### 2.5 Booking payment drift (`D-PAID-BOOKING-DRIFT`)

Symptom: finance shows `Paid` payment but booking `payment_status` still `unpaid`/`partial`.

1. Open recon triage: `/settings/reconciliation-triage` or query `finance_recon_findings` where `code = 'D-PAID-BOOKING-DRIFT'`.  
2. Confirm payment `Paid` + receipt `Approved` + ledger capture outbox present.  
3. **Auto-heal:** set `FINANCE_RECON_AUTO_REPAIR=1` (dev default in `.env.example`; enable in prod Prisma env). Next R3 scan (~15m) runs allowlisted repair for `D-PAID-BOOKING-DRIFT` and `D-PAID-NO-LEDGER`.  
4. **Manual:** use recon repair API/UI with `mode=manual` when auto-repair is intentionally off.  
5. Verify booking row `payment_status = paid` and finding `status = resolved`.

## 3. Recovery

### 3.1 Failed ledger retry (Paid, missing capture)

1. Confirm payment `Paid` + receipt `Approved`.  
2. Rebuild journal via workspace ledger policy inputs (amount/currency/registration from payment).  
3. Insert outbox row **only if** `domain_event_id = payment:{paymentId}:ledger-capture-anchor` absent (idempotent).  
4. Do **not** flip payment back to Pending.  
5. Verify relay publishes; clear mismatch gauge on next scrape.

### 3.2 Failed outbox replay

1. Read `last_error`; fix poison payload if needed (replay never rewrites payload).  
2. Dry-run: `POST /internal/outbox/:id/replay` or `POST /internal/outbox/replay` with ops JWT scope `outbox:replay` (default `dryRun: true`).  
3. Apply: same body with `dryRun:false`, `confirm:true`, `confirmPhrase:"REPLAY"`. Bulk modes: `batch` / `tenant` / `workspace` / `date_range`.  
4. Audit: `GET /internal/outbox/replay/runs/:runId`. See [`OUTBOX_PRODUCTION_REPLAY.md`](OUTBOX_PRODUCTION_REPLAY.md). CLI break-glass: `outbox:replay-failed -- --tenant=… [--apply]`.  
5. Watch pending age drop / relay `done`.

### 3.3 Stuck payment investigation

1. If no receipt → operator create/submit or cancel business process.  
2. If pending receipt → approve/reject via finance UI.  
3. If sibling already `Paid` on same registration → leave Pending; document; optional future void (not automated in 3.7).

### 3.4 Manual repair workflow

1. Open incident ticket (tenant, paymentId, workspace_type).  
2. Dual review for any compensating ledger insert.  
3. Record `reviewedBy` / ticket id in ops notes.  
4. Re-run diagnosis SQL; confirm gauges clear.  
5. Postmortem if mismatch > 0 for >1h.

## 4. SLO mapping

Authority: [`FINANCE_SLO_FRAMEWORK.md`](./FINANCE_SLO_FRAMEWORK.md) · matrix: [`FINANCE_SLO_ALERT_MATRIX.md`](./FINANCE_SLO_ALERT_MATRIX.md) · dashboard: `deploy/dashboards/finance-slo.json`.

| Alert / symptom | SLO | Diagnose | Recover |
| --------------- | --- | -------- | ------- |
| `FinanceApproveAvailabilityBurnFast/Slow` / `FinanceApproveFailureSpike` | F1 availability / error budget | §2.1 | Fix booking/DB; freeze features if budget exhausted |
| `FinancePaymentLatencyBudget` | F2 | Slow `createManualPayment` / Prisma | Pool + query; check tenant hotspot |
| `FinanceApproveLatencyBudget` | F3 | §2.1 + ledger build | Booking sync + ledger adapter |
| `FinanceLedgerLatencyBudget` / `FinanceLedgerCaptureFailure` | F4 | §2.2 | Adapter / empty lines / recon repair |
| `FinanceOutboxLagSloWarn` / `FinanceOutboxBacklog` | F5 | §2.3 | Relay scale; §3.2 replay |
| `FinanceReplayDurationHigh` / `FinanceReplayFailureSpike` | F6 | Replay audit run | Shrink scope; poison fix; OUTBOX_PRODUCTION_REPLAY |
| `FinanceReconciliationMismatch` / `FinanceReconFindingsOpen` | F7 | §2.2 | §3.1 + recon dry-run/apply |
| `FinanceErrorBudgetExhaustedProxy` | F1 budget | 30d availability < 99.9% | Reliability freeze + postmortem |
| `FinanceStuckPayments` | supporting | §2.4 | Operator queue |
| `FinanceDbOrStorageFailure` | resilience | Platform Postgres/MinIO | Escalate platform |

## 5. Escalation

| Layer | When |
| ----- | ---- |
| Host API | Money-path HTTP, approve TX, finance metrics, repair SOP |
| Workspace package owner | Wrong CoA / empty lines / unstable domainEventId |
| finance-core | Engine orchestration bug (rare; prove with unit) |
| Platform infra | Postgres, RLS, relay worker, MinIO, Alertmanager |

Disable finance module (theme) only as **last** blast-radius control — drains new traffic; does not repair Paid rows.
