# Receipt queue clarity — presentation only (PR23-B1)

```yaml
doc_id: FINANCE_RECEIPT_QUEUE_CLARITY_PR23_B1
version: "2026-08-09-v1"
status: READY_FOR_REVIEW
phase: PR23-B1
related:
  - apps/web/src/finance/finance-receipts-logic.ts
  - apps/web/src/finance/finance-receipts-panel.tsx
  - apps/web/messages/fa/finance.json
  - apps/web/messages/en/finance.json
locks:
  api_domain_change: forbidden
  sla_meaning: forbidden
  overdue_late_copy: forbidden
  fake_backlog_total: forbidden
  scope_before_limit: deferred_PR23_B2
```

## Principle

Operators need to understand the **existing** pending-receipt list without new API or domain rules.
All aging and queue honesty in this slice are **presentation hints** derived from `receipt.createdAt`
and the client-visible page size.

## Aging bands (UX constants — not SLA)

| Semantic id | Condition | Meaning |
| ----------- | --------- | ------- |
| `fresh` | age &lt; 4 hours | Recently submitted |
| `waiting` | 4h ≤ age &lt; 48h | Waiting for review |
| `longer` | age ≥ 48 hours | Waiting longer |

These thresholds are **UX knobs** in web logic. They:

- do **not** encode SLA
- do **not** mean overdue / late / escalation
- do **not** change receipt or payment state machines
- must never be labelled Failed or confused with payment Pending

Relative waiting time is also presentation-only (`createdAt` vs injectable `now`).

## FIFO clarity

Production list ordering remains backend `createdAt ASC` (oldest first). The UI states that fact;
it does **not** re-sort the fetched array.

## Queue honesty

| Fact | Rule |
| ---- | ---- |
| Shown count | `items.length` on the current page |
| Total pending | Only if already supplied as an optional prop — **no new fetch** in B1 |
| Fake totals | Forbidden — never invent a backlog number |
| Fetch limit (50) | When `shown === limit` and total unknown, show a soft “may be more” hint without a count |

Shown count is **not** total count.

## Explicit non-goals

- Scope-before-limit query fix (PR23-B2)
- Ownership, SLA enforcement, bulk review
- Approve/reject or receipt card redesign
- Payment vocabulary changes

## Status

`READY_FOR_REVIEW`
