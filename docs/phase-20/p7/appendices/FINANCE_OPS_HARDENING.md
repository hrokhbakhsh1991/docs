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

## Auto-repair guardrail (FC-0)

To prevent booking/payment projection drift from staying open in production:

| Guardrail | Rule |
| --------- | ---- |
| Runtime signal | When finance recon starts with `FINANCE_RECON_AUTO_REPAIR` disabled, host logs `finance.recon.auto_repair_disabled`. |
| Operator action | Enable `FINANCE_RECON_AUTO_REPAIR=1` in durable Prisma environments unless explicitly waived by incident policy. |
| Verification | Use startup logs + first recon scan event (`finance.recon.scan`) to confirm `auto_repaired` is non-zero when eligible findings exist. |

## Tour-level reporting (FC-3)

Host read-only dimension for multi-workspace finance ops:

| Surface | Contract |
| ------- | -------- |
| List scope | `?registrationId=` + `?tourId=` on payments, ledger, receipts, prepayments, schedules |
| Aggregate | `GET /finance/reports/by-tour?tourId=` — SQL join `payments` ↔ `operator_registrations` |
| Web | `FinanceTourFilter` (bookings summary tour chips) + overview `paidByTour` strip |

Proof: `apps/api/test/finance-reports-by-tour.spec.ts`, `apps/web/test/finance-tour-filter.spec.ts`.

## Commercial obligation bind (FC-2)

| Step | Enforcement |
| ---- | ----------- |
| Manual payment create | Warn log `finance.obligation.manual_amount_override` when amount > obligation + tolerance |
| Receipt approve | Block with `FINANCE_OBLIGATION_OVERPAY` when payment > obligation + tolerance |
| Invoice compile | `obligationMinor` after schedule sum, before payment-sum fallback |

Denali resolver: `resolveDenaliRegistrationObligationMinor` (`pricing.basePricePerPerson × partySize`, `offline_receipt` only).  
Host factory: `createFinanceObligationPort(workspaceType)` → `RegistrationFinanceObligationAdapter` when codegen `registrationObligation` binding exists (denali today), null port otherwise (P3.5).

Proof: `packages/workspaces/denali/test/finance-obligation.spec.ts`, `apps/api/test/finance-obligation-denali.spec.ts`.

Manual payment / prepayment forms pre-fill `amount` from invoice `balanceDueMinor` when registration is selected (falls back to `invoiceTotalMinor` when due is zero). Proof: `apps/web/test/finance-invoice-prefill.spec.ts`.

## Receipt media upload (FC-5)

Operator / portal happy path avoids raw `fileKey` entry:

| Step | Contract |
| ---- | -------- |
| Upload | `POST /finance/receipts/upload?registrationId=` — binary body, `Content-Type`, optional `X-Receipt-File-Name` |
| Storage | Host `putMemberReceiptProof` → tenant-scoped MinIO key under `receipts/{tenantId}/{registrationId}/` |
| Submit | Existing `POST /finance/receipts` with returned `fileKey` |
| Web BFF | `apps/web/app/api/finance/receipts/upload/route.ts` proxies bytes + headers |

Proof: `apps/api/test/finance-receipt-upload.spec.ts`, payments panel file input (replaces advanced file-key-only path for ops).

## Schedule item mutate (FC-4)

| Method | Path | Action |
| ------ | ---- | ------ |
| PATCH | `/finance/schedules/{registrationId}/items/{itemId}` | `action: waive` (admin + reason) or `action: reschedule` (+ ISO `dueAt`) |

Domain rules (finance-core):

- Sum of `amountMinor` across items unchanged after mutate (waive sets `status=waived` only).
- Waive blocked when item is `paid`.
- Reschedule recalculates `overdue` ↔ `scheduled` from new `dueAt`; no ledger mutation.
- Host emits durable outbox `finance.schedule.item_waived` with reason + actor on waive.

Proof: `apps/api/test/finance-schedule-mutate.spec.ts`, `apps/web/test/finance-installments-panel.spec.ts` (waive/reschedule wiring).

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
