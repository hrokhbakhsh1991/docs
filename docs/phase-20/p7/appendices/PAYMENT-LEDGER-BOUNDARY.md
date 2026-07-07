# Payment ingress vs ledger (P7 frozen)

```yaml
boundary_id: PAYMENT-LEDGER-BOUNDARY
pack: P7
version: "1.0"
authority: FINANCE-OPS-UX.md · FINANCE-OPS-P6-NOTE.md · platform-workspace-commerce.mdoc
payment_mode_p7: offline_receipt
```

## Two layers (do not conflate)

```text
┌─────────────────────────────────────────────────────────┐
│ Payment ingress (HOW money arrives) — mode-dependent      │
│   P7: offline_receipt only                               │
│   member upload → operator review                        │
│   Future: gateway PSP redirect/webhook (P5-D)            │
└──────────────────────────┬──────────────────────────────┘
                           │ capture confirmed
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Ledger / accounting (WHAT happened) — stable spine       │
│   InvoiceReadModel · BookingWallet · double-entry        │
│   Outbox: finance.ledger.double_entry_applied              │
└─────────────────────────────────────────────────────────┘
```

Switching workspace `paymentMode` (future, non-Denali) changes **ingress only**. Ledger accounts, outbox event type, and wallet projection **stay the same**.

---

## P7 payment model

| Fact | Detail |
| ---- | ------ |
| Denali frozen | `offline_receipt` only (PC-07) |
| Member path | Portal BFF → `POST /bookings/{id}/receipts` |
| Operator path | `GET /finance/receipts/pending` · `PATCH .../review` approve |
| API SoT | `apps/api/src/workspace-finance/` |
| Legacy forbidden | `apps/api/src/denali-finance/` — do not resurrect |

---

## Ledger spine (unchanged in P7)

| Step | Behavior |
| ---- | -------- |
| 1 | Manual `PaymentIntent` status `Pending` |
| 2 | `PaymentReceipt` submitted with `fileKey` |
| 3 | Operator approve → `postDoubleEntryJournal` |
| 4 | `emitFinanceLedgerDoubleEntryAppliedOutbox` |
| 5 | Payment → `Paid` · summary KPI updated |

Implementation: `apps/api/src/workspace-finance/finance.service.ts` → `reviewReceipt()`.

---

## Workspace commerce (future — not P7)

| Mode | Ingress | P7 |
| ---- | ------- | -- |
| `offline_receipt` | receipt upload + review | **active** |
| `gateway` | PSP + webhook | blocked (GU-02 until P5-D) |

Schema: `packages/workspace-sdk/src/metadata/commerce-schema.ts`  
Denali resolver: `DENALI_FROZEN_COMMERCE_CONFIG` in `resolve-workspace-commerce-for-tenant.ts`.

---

## P7 verification tiers (finance)

| Tier | Command | When |
| ---- | ------- | ---- |
| T1 | `p6:gate` · `p6-offline-receipt-gate.spec.ts` | every PR |
| T3 | `finance-ops.spec.ts` + staging `DATABASE_URL` | P7-3 pre-sign-off |
| T4 | [first-customer-operator.md](../../phase-19/p6/runbooks/first-customer-operator.md) VS-07 | manual sign-off |

---

## References

- [FINANCE-OPS-P6-NOTE.md](../../phase-19/p6/appendices/FINANCE-OPS-P6-NOTE.md)
- [platform-workspace-commerce.mdoc](../../phase-18/platform-workspace-commerce.mdoc)
- [POST-P7-HORIZON.md](POST-P7-HORIZON.md) — P5-D gateway
