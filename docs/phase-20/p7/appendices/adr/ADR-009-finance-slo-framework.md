# ADR-009 — Finance money-path SLO framework

```yaml
adr_id: ADR-009
title: Finance SLO framework
status: Accepted
date: "2026-07-19"
supersedes: []
related:
  - FINANCE_SLO_FRAMEWORK
  - FINANCE_SLO_ALERT_MATRIX
  - FINANCE_SLO_COVERAGE
  - FINANCE_OPS_HARDENING
  - ADR-007
```

## Status

Accepted (Phase 3.18 implemented).

## Context

Ops signals (Phase 3.7) lacked numeric error budgets and a single SRE pack for the finance money path (payment → receipt → approve → ledger outbox → relay → replay).

## Decision

1. Adopt catalog **SLO-F1…F7** with 30-day rolling availability/error budget unless noted:
   - **F1** Approve availability **99.9%** (replay excluded from failure denominator)
   - **F2** Payment latency 95% &lt; **2s**
   - **F3** Approve latency 95% &lt; **5s**
   - **F4** Ledger in-path 95% &lt; **1s**
   - **F5** Outbox lag target &lt; **60s** (page **300s**)
   - **F6** Replay single &lt; **5s**; bulk run &lt; **120s**
   - **F7** Paid↔ledger mismatch **= 0** (7d supporting consistency)
2. Error-budget policy: &gt;50% remaining normal; 10–50% freeze non-critical; &lt;10% money-path feature freeze + incident.
3. Ship checked-in `deploy/alerts/finance-slo.yaml` + `deploy/dashboards/finance-slo.json` + runbook mapping + `guard:deploy-finance-slo`.
4. Instrumentation: finance-core latency gauges + `finance_latency_budget_exceeded_total` (histogram p95 remains explicit P2).

## Consequences

- Enterprise money-path SRE bar is documentable and alertable.
- True Prometheus histograms and payment create success/failure pair remain known gaps (`FINANCE_SLO_COVERAGE`).
- Cluster Grafana import is an ops apply step (JSON is in-repo).

## Evidence

- [`../FINANCE_SLO_FRAMEWORK.md`](../FINANCE_SLO_FRAMEWORK.md)
- [`../FINANCE_SLO_ALERT_MATRIX.md`](../FINANCE_SLO_ALERT_MATRIX.md)
- [`../FINANCE_SLO_COVERAGE.md`](../FINANCE_SLO_COVERAGE.md)
- `deploy/alerts/finance-slo.yaml`
- `deploy/dashboards/finance-slo.json`
