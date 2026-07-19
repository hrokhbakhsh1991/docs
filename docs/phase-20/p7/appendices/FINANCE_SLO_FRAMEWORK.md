# Finance production SLO framework

```yaml
doc_id: FINANCE_SLO_FRAMEWORK
version: "1.0"
date: "2026-07-19"
phase: "3.18"
status: implemented
authority: FINANCE_OPS_HARDENING.md
related:
  - FINANCE_SLO_ALERT_MATRIX.md
  - FINANCE_SLO_COVERAGE.md
  - FINANCE-OPS-RUNBOOK.md
  - OUTBOX_PRODUCTION_REPLAY.md
  - deploy/alerts/finance-slo.yaml
  - deploy/dashboards/finance-slo.json
```

## Scope

Numeric SLOs for the **finance money path** on the host API (manual payment → receipt → approve → ledger outbox → relay). Complements Phase 3.7 ops signals with **error budgets**, latency budgets, and dashboard/alert wiring.

Window: **30-day** rolling for availability / error budget unless noted. Alert evaluation uses shorter burn windows (see alert matrix).

## SLO catalog

| ID | KPI | Objective | Indicator | Error budget |
| -- | --- | --------- | --------- | ------------ |
| **SLO-F1** | **Availability** (approve path) | **99.9%** successful approve decisions (excl. replay) | `finance_approve_total{result}` | **0.1%** failures / 30d |
| **SLO-F2** | **Payment latency** | **95%** create/replay < **2s** | `finance_payment_latency_ms` + `finance_latency_budget_exceeded_total{operation="payment"}` | 5% slow events / 30d |
| **SLO-F3** | **Approval latency** | **95%** approve TX < **5s** | `finance_approve_latency_ms` + budget exceeded `{operation="approve"}` | 5% slow / 30d |
| **SLO-F4** | **Ledger latency** | **95%** capture plan+enqueue instrumentation < **1s** (in-path) | `finance_ledger_latency_ms` + `{operation="ledger"}` | 5% slow / 30d |
| **SLO-F5** | **Outbox lag** | Oldest pending finance.* age **< 60s** (target); page at **300s** | `finance_outbox_oldest_pending_age_seconds` | Time above 60s counted in burn annotations (gauge SLO) |
| **SLO-F6** | **Replay duration** | Single apply p95 **< 5s**; bulk run **< 120s** | `outbox_replay_duration_ms` | Runs exceeding budget / total runs |
| **SLO-F7** | **Consistency** (supporting) | Paid↔ledger mismatch **= 0** (7d window) | `finance_reconciliation_mismatch` + `finance_recon_findings_open` | Any sustained >0 is budget burn (critical) |

### Availability definition (SLO-F1)

```text
availability = success / (success + failure)
replay counts are excluded from the denominator (idempotent reclaim, not a user-facing failure).
```

PromQL (30d):

```promql
sum(increase(finance_approve_total{result="success"}[30d]))
/
clamp_min(
  sum(increase(finance_approve_total{result=~"success|failure"}[30d])),
  1
)
```

### Error budget policy

| Budget | Action when exhausted |
| ------ | --------------------- |
| **>50% remaining** | Normal feature velocity |
| **10–50% remaining** | Freeze non-critical finance changes; prioritize reliability |
| **<10% remaining** | Feature freeze on money path; incident + postmortem required |
| **Burn alert** | Page on-call (see alert matrix multi-window burn) |

Monthly failure allowance at 99.9%: ≈ **43 minutes** equivalent downtime *or* ≈ **0.1%** of approve attempts (use attempt-based for this path).

## Latency budgets (numeric)

| Operation | Soft (observe) | Hard (budget exceeded counter) | Alert |
| --------- | -------------- | ------------------------------ | ----- |
| Payment create | gauge last ms | **> 2000 ms** | warning 15m |
| Approve | gauge last ms | **> 5000 ms** | warning 15m |
| Ledger capture (in-path) | gauge last ms | **> 1000 ms** | warning 15m |
| Outbox lag | gauge age s | target **60s**, page **300s** | existing + SLO warn |
| Replay duration | gauge per run | single **> 5000 ms**, bulk **> 120000 ms** | warning |

Instrumentation notes: registry is gauge/counter (no native histogram). SLOs use **budget-exceeded counters** for ratio math and **last latency gauges** for dashboards. True p95 histograms remain a P2 enhancement.

## Dashboard

Grafana: [`deploy/dashboards/finance-slo.json`](../../../deploy/dashboards/finance-slo.json)

Panels map 1:1 to SLO-F1…F7 + error budget remaining.

## Alerts

[`deploy/alerts/finance-slo.yaml`](../../../deploy/alerts/finance-slo.yaml) + existing [`finance-ops.yaml`](../../../deploy/alerts/finance-ops.yaml).

Full matrix: [`FINANCE_SLO_ALERT_MATRIX.md`](./FINANCE_SLO_ALERT_MATRIX.md).

## Runbook mapping

[`FINANCE-OPS-RUNBOOK.md`](./FINANCE-OPS-RUNBOOK.md) § SLO — each alert → diagnosis § → recovery §.

## Verification

```bash
pnpm --filter @apps/api run guard:deploy-finance-ops-alerts
pnpm --filter @apps/api run guard:deploy-finance-slo
```
