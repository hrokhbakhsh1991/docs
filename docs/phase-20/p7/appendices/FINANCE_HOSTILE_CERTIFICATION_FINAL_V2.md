# Final hostile enterprise finance certification (re-score)

```yaml
cert_id: FINANCE_HOSTILE_CERTIFICATION_FINAL
version: "2.0"
date: "2026-07-19"
compares_to: FINANCE_HOSTILE_CERTIFICATION_FINAL v1.0 (composite 61)
method: hostile re-score after Phase 3.7 ops hardening + recon design + integrity/auth audits
delta_inputs:
  - FINANCE_OPS_HARDENING.md (metrics/alerts/runbook shipped)
  - FINANCE-OPS-RUNBOOK.md
  - deploy/alerts/finance-ops.yaml
  - FINANCE_RECONCILIATION_DESIGN.md (design only)
  - FINANCE_HOSTILE_ACCOUNTING_INTEGRITY.md
  - FINANCE_HOSTILE_AUTHORIZATION.md
```

## Score change vs v1.0

| Dimension | v1.0 | v2.0 | Δ | Why |
| --------- | ---: | ---: | -- | --- |
| **Architecture** | 72 | **73** | +1 | Recon designed inside host/outbox boundaries; no structural debt added |
| **Correctness** | 62 | **63** | +1 | Invariants still FAIL; gaps now **detectable** (`skipped_empty`, mismatch gauge) — not fixed |
| **Security** | 58 | **58** | 0 | Member IDOR on `POST /finance/receipts` **unfixed** |
| **Operations** | 38 | **56** | **+18** | Metrics + PrometheusRule + runbook + scrape gauges shipped; recon **job/repair not implemented** (design only) |
| **Maintainability** | 74 | **76** | +2 | Metric catalog, ops guard, recon/auth/integrity docs |

**Composite:** **61 → 65 / 100** (**+4**)

```text
Ops was the only large move. Enterprise still blocked on money integrity + IDOR + unimplemented recon repair.
```

---

## Classification

| Label | v1.0 | v2.0 |
| ----- | ---- | ---- |
| Prototype | No | No |
| Product | Partial | Partial |
| **Platform** | **Yes** | **Yes** |
| Enterprise Platform | No | **No** (unchanged) |

**Final classification: Platform** (production-operable *signals* improving; not enterprise-certified).

---

## Questions

| # | Question | Verdict | vs v1.0 |
| - | -------- | ------- | ------- |
| 1 | Ready for **enterprise production**? | **NO** | Unchanged |
| 2 | Ready for **10 concurrent workspace deployments**? | **CONDITIONAL** — plugin host YES; 10 enterprise products NO | Unchanged |
| 3 | Ready for **internal platform reuse**? | **YES** | Unchanged |
| 4 | **Extraction still unnecessary**? | **YES** — decision A stands; still unnecessary | Unchanged |

---

## Remaining blockers (enterprise)

### P0 (must clear for Enterprise Platform)

1. **Security:** member IDOR — `POST /finance/receipts` without ownership (`FINANCE_HOSTILE_AUTHORIZATION`).  
2. **Correctness:** Paid/Approved without ledger (empty lines / non-durable omit); prepay enqueue result ignored (`FINANCE_HOSTILE_ACCOUNTING_INTEGRITY`).  
3. **Correctness:** TourCreated ledger ∩ payment capture double-credit risk.  

### P1 (ops completeness — started, not done)

4. Implement recon jobs + findings + flagged repair (`FINANCE_RECONCILIATION_DESIGN` still **design**).  
5. Prod-gated outbox replay (DEC-086).  
6. Empty-lines **fail-closed** on approve (detect-only today).  
7. Written numeric SLOs + dashboard (alerts exist; SLO doc thin).  

### P1/P2 (10-product claim)

8. Per-workspace product/ops parity (panels/HTTP) if claiming ten customer products.  

### Extraction

9. Still unnecessary; publish/extract not required for current single-host platform.

---

## What improved (honest)

| Was blocker in v1.0 ops list | Now |
| ---------------------------- | --- |
| Finance metrics | **Shipped** |
| Paging alerts | **Shipped** (`finance-ops.yaml`) |
| Incident runbook | **Shipped** |
| Paid↔ledger consistency job | **Detect gauge only**; full job/repair = design |
| Repair path | **SOP + design**; not automated code |
| SLOs | Alerts present; formal error-budget SLOs still thin |

---

## One-line cert (v2.0)

**Internal Platform: certified. Ops detect/page: materially improved (+18 ops). Enterprise Platform: not certified — IDOR + Paid-without-ledger + unimplemented recon repair remain.**
