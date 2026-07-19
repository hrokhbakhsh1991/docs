# Finance operational readiness — enterprise launch gate

```yaml
audit_id: FINANCE_OPERATIONAL_READINESS_ENTERPRISE
version: "1.0"
date: "2026-07-19"
assume:
  tenants: 100
  workspace_plugins: 10
  payments: 1_000_000
  env: production (Prisma durable)
method: code + existing hostile ops docs; gaps counted as missing
```

## Verdict

**Not enterprise-launch ready.** Money paths have recovery *primitives* (TX rollback, idempotency, outbox replay admin, prepay booking-sync retry). They lack **detect → page → repair → prove SLO** for finance at 100×10×1M scale.

---

## Monitoring

### What metrics exist?

| Signal | Exists? | Notes |
| ------ | ------- | ----- |
| `finance_prepayment_booking_sync_degraded_persist_failed_total` | **Yes** | **Only** finance-core `metrics.increment` call |
| Platform outbox gauges (pending / failed / relay lag) | **Yes** (host outbox) | Not finance-labeled; shared all event types |
| Generic HTTP / process metrics | **Yes** (platform) | Not money-path specific |
| Approve success/fail, conflict, booking sync miss | **No** | Port wired; unused on approve path |
| Ledger enqueue skip / empty lines / duplicate | **No** | |
| Paid without ledger / receipt backlog age | **No** | |
| Per-`workspaceType` / per-tenant finance volume | **No** | Critical at 10 plugins × 100 tenants |
| Approve/prepay latency histograms | **No** | |

Evidence: `FinanceService` → single increment at degraded-persist failure; `HostFinanceMetricsAdapter` → `metricsRegistry`; no `finance_` series under `apps/api/src/observability`.

### What alerts exist?

| Alert | Exists in repo evidence? |
| ----- | ------------------------ |
| Finance approve error rate | **No** |
| Ledger missing for Paid | **No** |
| Finance outbox / reaction failure | **No** (generic outbox failed gauge may exist platform-wide; no finance-scoped rule found) |
| Booking-sync degraded backlog | **No** |
| Idempotency reclaim storm | **No** |

**At 1M payments:** without counters + alerts, silent Paid-without-ledger and stuck Pending receipts are customer-discovered.

---

## Operations (recovery)

| Capability | Status | Scale note (1M payments) |
| ---------- | ------ | ------------------------ |
| **Stuck payment recovery** | **Partial** | Pending payment + rejected receipt can retry manually via product UI. **No** job/API to find aged Pending, orphan payments, or auto-void losers after sibling Paid. |
| **Failed ledger recovery** | **Missing** | No detector/repair for `Payment.Paid` ∧ no `finance.ledger.double_entry_applied` (empty lines / bugs). No compensating reverse journal workflow in API. |
| **Outbox replay** | **Host primitive** | `POST /internal/outbox/:id/replay` — failed→pending; **non-prod gated** (DEC-086). Prod needs controlled admin path + poison-pill SOP. Relay + shutdown drain exist (platform). |
| **Reconciliation jobs** | **Missing for finance** | Tour **projection** auto-reconcile exists — **not** Paid↔ledger↔booking. Prepay: list degraded + `booking-sync-retry` only. No scheduled Paid-vs-ledger scan. |
| Prepay booking sync degrade | **Exists** | Outbox events + list + retry — good pattern; not mirrored for approve/ledger holes. |

At **100 tenants × 10 plugins**, ops must be **tenant- and workspaceType-scoped** (query filters, alert labels). Today tools are mostly global or single-tenant manual HTTP.

---

## Runbook

| Runbook | Status |
| ------- | ------ |
| Approve TX failure / booking sync miss | **Missing** as single finance incident doc (ownership matrix only) |
| Paid/Approved without ledger | **Missing** |
| Outbox poison / finance reaction fail | **Partial** — generic outbox-failed-replay doc; not finance-specific |
| Disable finance module + drain | **Missing** consolidated |
| Wrong CoA / double TourCreated+capture | **Missing** |
| 1M-row investigation queries (indexes, time bounds) | **Missing** |

Ownership doc admits: *“No consolidated finance incident/rollback runbook.”*

---

## SLO

| SLO | Status |
| --- | ------ |
| Approve availability / error budget | **Missing** |
| Approve p99 latency | **Missing** |
| Ledger outbox lag (finance events) | **Missing** (generic outbox lag may exist; not finance SLO) |
| Paid→ledger consistency (≤ N minutes, 0 missing) | **Missing** — must-have at enterprise |
| Receipt pending age / review SLA | **Missing** |
| Prepay booking-sync degrade MTTR | **Missing** |

Operator finance UI KPIs ≠ SRE SLOs.

---

## What must exist before enterprise launch

Ordered as a **launch checklist** (must = ship blocker).

### Must (P0) — detect & stop silent money loss

1. **Metrics (emit + scrape)**  
   - `finance_approve_total{result,workspace_type}`  
   - `finance_approve_booking_sync_miss_total`  
   - `finance_ledger_enqueue_total{result}` including `skipped_empty_lines`  
   - `finance_prepayment_total{result}`  
   - `finance_paid_without_ledger_gauge` (or scrape job)  
   - Labels: at least `workspace_type`; tenant high-cardinality only via sampled/top-N or logs  

2. **Alerts (page)**  
   - Approve 5xx / conflict spike  
   - `skipped_empty_lines` or Paid-without-ledger > 0  
   - Finance-relevant outbox failed / lag above threshold  
   - Degraded booking-sync backlog age  
   - Optional: idempotency reclaim rate  

3. **Consistency job (scheduled)**  
   - Scan: `payments.status=Paid` without matching `finance.ledger.double_entry_applied` for `payment:{id}:ledger-capture-anchor` (batched; 1M-safe indexes)  
   - Emit metric + ticket/page; optional repair enqueue  

4. **Repair path**  
   - Documented + tooling: re-enqueue missing capture **or** compensating reverse (never silent rewrite)  
   - Prod-safe outbox replay for finance poison pills  

5. **SLOs written + dashboard**  
   - Availability approve/prepay  
   - Consistency: 100% Paid have ledger within T (e.g. 5–15 min)  
   - Outbox finance lag  

6. **Incident runbook pack** (one place)  
   - Stuck Pending / sync miss  
   - Paid without ledger  
   - Outbox replay  
   - Module disable + drain  
   - Per-plugin (workspace) escalation (CoA owners)

### Should (P1) — operate 100×10 without heroics

7. Stuck-payment / aged-receipt **ops queries or job** (Pending > N days).  
8. Tracing/correlation: HTTP → approve TX → outbox id.  
9. Load proof: concurrent approve + relay under multi-tenant volume (not only unit IDEM).  
10. Log redaction policy for amounts / `fileKey`.  
11. Postgres finance integration suites **required** in release CI (no skip-green).  
12. Capacity: index/partition story for `payments` / `payment_receipts` / outbox at 1M+ (ops review).

### Nice (P2)

13. Per-tenant finance volume dashboards.  
14. Automated void of losing Pending siblings after Paid.  
15. Fine-grained finance on-call schedule vs host API.

---

## Scale stress (why the bar is high)

| Load dimension | Failure mode if ops incomplete |
| -------------- | ------------------------------ |
| 1M payments | Manual SQL reconciliation impossible; need jobs + metrics |
| 100 tenants | Need tenant-scoped alerts/runbooks; global pages drown signal |
| 10 plugins | Wrong CoA/empty lines may be **per-type**; alerts need `workspace_type` |

---

## Direct answers

| Question | Answer |
| -------- | ------ |
| What metrics exist? | Effectively **one** finance counter + shared outbox gauges |
| What alerts exist? | **None** finance-specific evidenced |
| Stuck payment recovery? | Manual/product only; no systematic recovery |
| Failed ledger recovery? | **Absent** |
| Outbox replay? | Host admin primitive (non-prod gate); not finance runbooked for prod |
| Reconciliation jobs? | **No** Paid↔ledger job; prepay degrade list/retry only |
| Runbook? | **Missing** consolidated |
| SLO? | **Missing** |

**Enterprise launch gate: FAIL until P0 checklist items 1–6 exist in production.**
