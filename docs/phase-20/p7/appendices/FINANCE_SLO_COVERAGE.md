# Finance SLO coverage report

```yaml
doc_id: FINANCE_SLO_COVERAGE
version: "1.0"
date: "2026-07-19"
phase: "3.18"
```

## KPI → artifact coverage

| KPI (requested) | SLO ID | Metric(s) | Dashboard panel | Alert(s) | Runbook |
| --------------- | ------ | --------- | --------------- | -------- | ------- |
| **Availability** | F1 | `finance_approve_total{result}` | Approve availability + approve results | Burn fast/slow, ApproveFailureSpike, ErrorBudgetExhaustedProxy | §2.1 / §4 |
| **Payment latency** | F2 | `finance_payment_latency_ms`, `finance_latency_budget_exceeded_total{operation="payment"}` | Last latency + budget exceeded | `FinancePaymentLatencyBudget` | §4 |
| **Approval latency** | F3 | `finance_approve_latency_ms`, budget `{operation="approve"}` | Last latency + budget exceeded | `FinanceApproveLatencyBudget` | §2.1 / §4 |
| **Ledger latency** | F4 | `finance_ledger_latency_ms`, budget `{operation="ledger"}`, `finance_ledger_capture_total` | Last latency + ledger results | `FinanceLedgerLatencyBudget`, `FinanceLedgerCaptureFailure` | §2.2 / §4 |
| **Outbox lag** | F5 | `finance_outbox_oldest_pending_age_seconds` | Outbox lag | `FinanceOutboxLagSloWarn` (60s), `FinanceOutboxBacklog` (300s) | §2.3 / §3.2 |
| **Replay duration** | F6 | `outbox_replay_duration_ms`, `outbox_replay_events_total` | Replay duration + events | `FinanceReplayDurationHigh`, `FinanceReplayFailureSpike` | §3.2 / OUTBOX_PRODUCTION_REPLAY |
| **Error budget** | F1 | 30d availability vs 99.9% | Error budget remaining | Burn + `FinanceErrorBudgetExhaustedProxy` | §4 + SLO framework |
| **Alert thresholds** | — | Matrix | — | `finance-slo.yaml` + `finance-ops.yaml` | `FINANCE_SLO_ALERT_MATRIX.md` |

## Deliverable checklist

| Deliverable | Path | Status |
| ----------- | ---- | ------ |
| SLO document | `FINANCE_SLO_FRAMEWORK.md` | **Covered** |
| Dashboard metrics | `deploy/dashboards/finance-slo.json` | **Covered** |
| Alert matrix | `FINANCE_SLO_ALERT_MATRIX.md` + `deploy/alerts/finance-slo.yaml` | **Covered** |
| Runbook mapping | `FINANCE-OPS-RUNBOOK.md` §4 | **Covered** |
| Latency instrumentation | finance-core `recordLatency` + host `observe` | **Covered** |
| Guard | `guard:deploy-finance-slo` | **Covered** |

## Gaps (explicit)

| Gap | Severity | Notes |
| --- | -------- | ----- |
| Native Prometheus histograms / true p95 | P2 | Gauges + budget-exceeded counters stand in for ratio SLOs |
| Alertmanager per-tenant routing | P2 | Labels present; routes out of repo |
| Recording rules for pre-aggregated burn | P2 | Inline PromQL in alerts |
| Grafana provisioning ConfigMap | P2 | JSON checked in; cluster import is ops apply step |
| Payment “availability” separate from approve | P2 | Payment create has no success/failure counter pair yet (latency only) |

## Coverage score

**8 / 8 requested KPIs mapped** to metrics + alerts + runbook.  
**Instrumentation maturity:** counters/gauges + budget counters (**not** full histogram SRE pack).
