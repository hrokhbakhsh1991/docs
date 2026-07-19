# Phase 3.7 — Finance operations hardening

```yaml
phase: "3.7"
doc_id: FINANCE_OPS_HARDENING
version: "1.0"
date: "2026-07-19"
goal: internal Platform → production-operable (detect / page / repair)
boundaries: unchanged (finance-core ports, host Prisma/outbox, workspace adapters)
```

## Goal

Close the ops gap from hostile certification (ops **38/100**) without redesigning architecture.

## Deliverables

| # | Area | Artifact |
| - | ---- | -------- |
| 1 | Metrics | Engine counters + host gauges; Prometheus scrape |
| 2 | Alerts | `deploy/alerts/finance-ops.yaml` + this catalog |
| 3 | Recovery design | § Recovery below + runbook |
| 4 | Runbook | [`FINANCE-OPS-RUNBOOK.md`](./FINANCE-OPS-RUNBOOK.md) |

## Metric catalog

| Metric | Type | Labels | Emitter |
| ------ | ---- | ------ | ------- |
| `finance_payment_created_total` | counter | `tenant_id`, `workspace_type` | finance-core |
| `finance_receipt_submitted_total` | counter | `tenant_id`, `workspace_type` | finance-core |
| `finance_approve_total` | counter | `tenant_id`, `workspace_type`, `result` | finance-core (`success` \| `failure` \| `replay`) |
| `finance_ledger_capture_total` | counter | `tenant_id`, `workspace_type`, `result` | finance-core (`success` \| `failure` \| `skipped_empty` \| `omitted_non_durable`) |
| `finance_reaction_failed_total` | counter | `tenant_id`, `workspace_type` | host reaction HostIo |
| `finance_outbox_oldest_pending_age_seconds` | gauge | — | host scrape refresh (finance ledger/prepay event types) |
| `finance_reconciliation_mismatch` | gauge | — | host scrape (Paid w/o capture outbox) |
| `finance_stuck_payments` | gauge | — | host scrape (Pending payment age ≥ threshold) |
| `finance_prepayment_booking_sync_degraded_persist_failed_total` | counter | `tenant_id` | existing |

Cardinality: tenant × workspace_type is intentional for ≤100 tenants × ~10 types. Do not add unbounded labels (paymentId, etc.).

## Alert catalog

See `deploy/alerts/finance-ops.yaml`:

| Alert | Signal |
| ----- | ------ |
| `FinanceLedgerCaptureFailure` | `skipped_empty` / `failure` rate |
| `FinanceOutboxBacklog` | finance pending age |
| `FinanceApproveFailureSpike` | `result=failure` increase |
| `FinanceStuckPayments` | stuck gauge > 0 |
| `FinanceReconciliationMismatch` | mismatch gauge > 0 |
| `FinanceDbOrStorageFailure` | `db_circuit_open` / approve failure correlation (see rules) |

Platform outbox alerts (`AppTourOutbox*`) remain complementary.

## Recovery design (boundaries preserved)

| Scenario | Detection | Action | Owner |
| -------- | --------- | ------ | ----- |
| Failed ledger (Paid, no outbox) | mismatch gauge + runbook SQL | Manual: verify payment; re-enqueue via **controlled** compensating outbox insert (same `domainEventId`) or finance reverse journal policy from workspace — **no** silent Payment status rewrite in engine | host API |
| Failed outbox | `outbox_failed_total` / finance age | Prod: secure ops replay (extend DEC-086 beyond non-prod) or SQL status→pending after poison fix | platform + host |
| Stuck payment | `finance_stuck_payments` | Investigate Pending+receipt state; reject/approve; void sibling debts manually | host API |
| Manual repair | Runbook checklist | Ticket + dual control; never delete Paid rows | host API |

Repair **APIs that mutate money** are intentionally **not** added in 3.7 (avoid new attack surface). Design = queries + gated replay + human SOP.

## Implemented vs missing (Phase 3.7 ship)

### Implemented

| Item | Status |
| ---- | ------ |
| Payment / receipt / approve / ledger capture counters | Engine (`FINANCE_METRIC`) |
| `tenant_id` + `workspace_type` labels | Yes |
| Reaction failure counter | HostIo `logReactionFailed` |
| Outbox pending age (finance events) | Scrape gauge |
| Reconciliation mismatch gauge (7d Paid w/o capture) | Scrape gauge |
| Stuck payments gauge (Pending ≥ 24h) | Scrape gauge |
| PrometheusRule alerts | `deploy/alerts/finance-ops.yaml` |
| Guard | `pnpm --filter @apps/api run guard:deploy-finance-ops-alerts` |
| Runbook + recovery design | `FINANCE-OPS-RUNBOOK.md` |

### Missing (explicit)

| Item | Pri | Notes |
| ---- | --- | ----- |
| Prod-gated outbox replay HTTP (DEC-086 still non-prod) | **P1** | Design + runbook; no new mutate API in 3.7 |
| Automated ledger re-enqueue job | **P1** | Manual SOP only |
| Per-tenant alert routing / silence | **P2** | Labels present; AM routes out of repo |
| Histogram latency SLOs | **Done (3.18)** | Budget counters + last-latency gauges — see `FINANCE_SLO_FRAMEWORK.md` (true p95 histograms still P2) |
| Full-table recon (all Paid ever) | **P2** | 7d window by design |

### P0 / P1 / P2 (remaining after 3.7)

| Pri | Item |
| --- | ---- |
| **P0** | None for *signal presence* — alerts/metrics/runbook shipped. Accounting empty-lines bug still a **product** P0 (capture can still skip); now **detectable** via `skipped_empty` + mismatch gauge. |
| **P1** | Prod replay path; automated repair; empty-lines fail-closed (correctness, not ops wire) |
| **P2** | Latency histograms; AM tenant routes; unbounded historical recon |
