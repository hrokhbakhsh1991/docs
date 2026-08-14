# Denali Finance Overview UX — PR21-B1

```yaml
doc_id: DENALI_FINANCE_OVERVIEW_UX_PR21_B1
version: "2026-08-08-v1"
status: IMPLEMENTATION
phase: PR21-B1
continues:
  - DENALI_FINANCE_CUSTOMER_HANDOFF_GATE
  - PR21-B Overview deep audit (READY_FOR_OVERVIEW_UX_IMPLEMENTATION)
locks:
  - FinanceService / finance-core / Case / Command Bridge / SoT / APIs / flags unchanged
  - No enablement of prepayments / installments / open-payments
scope: apps/web Finance Overview + Command Center shell guidance only
```

## Purpose

Make `/finance` Overview an **operational starting point** for Denali’s first-customer contract:

1. No out-of-scope installment/prepayment **teaching or work signals** when those panels are disabled.
2. Attention deep links **preserve `registrationId`**.
3. **Needs attention** is visually first; ledger/reconciliation stay secondary.
4. Attention priority: pending receipts → pending manuals (installment attention only when `panels.installments`).

## Operator information model

```text
Needs attention (scoped registration deep links)
        ↓
Financial snapshot (KPIs — installments gated by manifest)
        ↓
Do next (manual payment; reconciliation secondary)
        ↓
By tour
        ↓
Audit (recent ledger)
```

## Manifest-driven gating

| Panel flag | Overview effect |
| ---------- | --------------- |
| `panels.installments === false` | No overdue-installments KPI; no overdue attention; no `tab=installments` href; no schedules-driven attention composition |
| `panels.prepayments === false` | Shell decision guide / tab guidance omit prepayment teaching lines |
| Both false | Shell omits installment teaching lines |

Underlying installment/prepayment APIs and tabs remain implemented; they stay **unreachable from Overview** when disabled.

## Attention destinations

| Kind | Href (when registration present) |
| ---- | -------------------------------- |
| `pending-receipt` | `/finance?tab=receipts&registrationId=<id>` |
| `pending-manual` | `/finance?tab=payments&registrationId=<id>` |
| `overdue-installment` | Only when installments enabled: `/finance?tab=installments&registrationId=<id>` |

Uses existing `withFinanceRegistrationQuery` helper — no Case/executionId leakage.

## Non-goals (deferred)

Receipt review package (remaining/history), partial booking refresh, soft-fail empty distinction, Meaning nav from Overview, case-first IA, SSR prefetch, ledger label localization.

## Acceptance

Operator opening `/finance` sees attention first, can click into a registration-scoped receipts/payments tab, and is not taught disabled installment/prepayment workflows.
