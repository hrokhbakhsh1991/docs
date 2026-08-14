# Denali Finance Micro-UX — PR21-G1 + PR21-G2

```yaml
doc_id: DENALI_FINANCE_MICRO_UX_PR21_G1_G2
version: "2026-08-09-v1"
status: IMPLEMENTATION
phase: PR21-G1 + PR21-G2
continues:
  - DENALI_FINANCE_BOOKING_STRIP_UX_PR21_F
  - DENALI Finance deep micro-UX audit (R-01/R-02, B-01…B-06)
locks:
  - FinanceService / finance-core / Case / Command Bridge / SoT / APIs / flags unchanged
  - No N+1 / new DTOs / new workflows
scope: apps/web Receipts empty/loading presentation + Booking Inspection / Financial Strip hierarchy
```

## G1 — Receipts state clarity

Presentation state machine:

| Phase | UI |
| ----- | --- |
| `loading` (request in flight, not yet settled) | Skeleton only — never true-empty copy |
| `ready` + 0 items | True empty copy + one sensible next surface (Payments, registration-preserving when filtered) |
| `ready` + items | Existing PR21-D review package unchanged |
| `error` | Error alert — never empty copy |

Avoid empty flash: do not treat “not loaded” as empty.

## G2 — Booking Inspection hierarchy

```text
Identity + booking/payment badges
        ↓
Financial Strip (money → one settlement line → compact rows → one Payments CTA)
        ↓
Intake / timeline (secondary)
        ↓
Approve / waitlist / Cancel (destructive not first)
```

Strip rules:

- One primary **Open Payments** CTA (`registrationId` preserved)
- Receipts + Meaning remain secondary distinct destinations
- Remove redundant View details / duplicate Payments links
- Booking settlement narrative once (not per payment row)
- Title: latest payments (does not claim complete history / no fake totals)
- Preserve PR21-F next-step: Pending→Payments; else Receipts; paid→no finance next-step

## Non-goals

Payments list density, Overview attention “+N more”, Ledger/Meaning English chrome (record only).
