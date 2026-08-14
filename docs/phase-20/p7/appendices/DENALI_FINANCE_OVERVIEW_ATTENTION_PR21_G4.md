# Denali Finance Overview Attention — PR21-G4

```yaml
doc_id: DENALI_FINANCE_OVERVIEW_ATTENTION_PR21_G4
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR21-G4
continues:
  - DENALI_FINANCE_PAYMENTS_DENSITY_PR21_G3
  - DENALI Finance deep micro-UX audit (O-01…O-06)
locks:
  - FinanceService / finance-core / Case / Meaning / Command Bridge / SoT / APIs / BFF / DB unchanged
  - No fetch-all for Overview; no second Payments queue; no new attention endpoints
  - Attention kinds unchanged: pending-receipt → pending-manual (installments gated)
scope: apps/web Overview attention preview overflow + identity density + KPI link clarity
```

## Audit — why KPI ≠ Attention

| Signal | Source | Meaning |
| ------ | ------ | ------- |
| KPI `pending-manual` | `GET /api/finance/reports/summary` → `pendingManualPayments` | Aggregate population count |
| Attention rows | Client builds `buildFinanceAttentionSamples` with `FINANCE_ATTENTION_SAMPLE_LIMIT = 3` from `payments?limit=20` + `receipts/pending?limit=20` | Intentional discovery **preview** |

Priority inside the sample (installments off): receipts → pending manuals. Max **3** rows rendered.

Therefore **22 vs 3 is legitimate**: KPI = total queue size; Attention = preview sample. Operators must see that the preview is incomplete when totals exceed shown rows.

Overflow uses **summary totals − shown-by-kind in the sample** (not “fetch all 22”). Destinations are aggregate tabs (`/finance?tab=payments|receipts`), not a mini-queue.

## G4 slices

| ID | Change |
| -- | ------ |
| G4-1 | Attention header: shown count |
| G4-2 | Kind-aware “+N more …” links (payments / receipts / overdue when enabled) |
| G4-3 | Overflow → correct operational tab (no invented queue) |
| G4-4 | Keep limit=3; no Overview pagination |
| G4-5 | Compact identity on attention rows |
| G4-6 | Preserve source ordering (receipts before manuals; overdue first if gated on) |
| G4-7 | Amount exists on payment fetch rows but omitted from attention sample — no N+1; record as future capability |
| G4-8 | KPI remains aggregate; clearer list-open copy on pending cards |
| G4-9 | Create manual stays secondary under Do next |

## Non-goals

Payments density (G3), Ledger English chrome, Inbox badge tension, Overview full redesign.
