# Finance SLO — alert matrix

```yaml
doc_id: FINANCE_SLO_ALERT_MATRIX
version: "1.0"
date: "2026-07-19"
related: FINANCE_SLO_FRAMEWORK.md, deploy/alerts/finance-slo.yaml, deploy/alerts/finance-ops.yaml
```

## Matrix

| Alert | SLO | Severity | Threshold | For | Signal | Runbook § |
| ----- | --- | -------- | --------- | --- | ------ | --------- |
| `FinanceApproveAvailabilityBurnFast` | F1 | critical | 2% fail ratio in 1h **and** 10% in 5m | 2m | approve failure burn | §2.1 / §SLO |
| `FinanceApproveAvailabilityBurnSlow` | F1 | warning | 0.5% fail ratio in 6h | 15m | slow burn | §2.1 / §SLO |
| `FinancePaymentLatencyBudget` | F2 | warning | `finance_latency_budget_exceeded_total{operation="payment"}` increase > 0 | 15m | slow payment creates | §SLO-F2 |
| `FinanceApproveLatencyBudget` | F3 | warning | `{operation="approve"}` increase > 0 | 15m | slow approve | §2.1 |
| `FinanceLedgerLatencyBudget` | F4 | warning | `{operation="ledger"}` increase > 0 | 15m | slow ledger path | §2.2 |
| `FinanceOutboxLagSloWarn` | F5 | warning | age **> 60s** | 10m | lag above target | §2.3 |
| `FinanceOutboxBacklog` | F5 | warning | age **> 300s** | 10m | page threshold (ops yaml) | §2.3 / §3.2 |
| `FinanceReplayDurationHigh` | F6 | warning | `outbox_replay_duration_ms` **> 120000** (bulk) or labeled single **> 5000** | 5m | slow replay | §3.2 |
| `FinanceReplayFailureSpike` | F6 | warning | `outbox_replay_events_total{outcome="error"}` increase > 0 | 10m | replay errors | §3.2 |
| `FinanceReconciliationMismatch` | F7 | critical | mismatch gauge > 0 | 15m | Paid w/o ledger | §2.2 / §3.1 |
| `FinanceReconFindingsOpen` | F7 | warning | `finance_recon_findings_open` > 0 | 30m | open findings | recon foundation |
| `FinanceLedgerCaptureFailure` | F4/F7 | critical | capture failure/skipped_empty | 5m | ops yaml | §2.2 |
| `FinanceApproveFailureSpike` | F1 | critical | >5 failures / 15m | 5m | ops yaml | §2.1 |
| `FinanceStuckPayments` | supporting | warning | stuck gauge > 0 | 30m | ops yaml | §2.4 |
| `FinanceDbOrStorageFailure` | F1 resilience | critical | circuit / extreme fail | 2m | ops yaml | §1 |

## Error-budget burn (F1)

Fast burn (page): short window high failure ratio → imminent budget exhaustion.  
Slow burn (ticket): sustained elevated failure ratio → schedule reliability work.

## Silence / routing

| Label | Value |
| ----- | ----- |
| `team` | `host-api` (finance path) / `platform` (DB circuit) |
| `slo` | `finance_availability` \| `finance_latency_*` \| `finance_outbox` \| `finance_replay` \| `finance_consistency` |

Alertmanager tenant routes: out of repo (P2).
