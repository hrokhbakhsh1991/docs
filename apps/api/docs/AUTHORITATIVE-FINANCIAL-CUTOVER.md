# Authoritative financial cutover (P3-G)

Verification snapshot: finance **pricing** and **ledger** paths used in production registrations and payments are authoritative; legacy math exists only for **opt-in** drift diagnostics.

## Pricing

| Concern | Authoritative path | Legacy / shadow |
|--------|---------------------|-----------------|
| Registration quote & payable snapshot | `RegistrationQuoteApplicationService.buildQuoteSnapshot` → `PricingEngineService.quote` → `calculateQuote` (`modules/finance/pricing`) | `computeLegacyCatalogQuote` runs **only** when `PricingEngineQuoteOptions.financeShadowCompare === true` (not passed on default registration flow). |
| Returned totals | Always from finance `PricingQuote` mapped in `financeQuoteToResult`. | Same row; optional `logPricingShadowDiff` compares legacy vs finance when flag set. |
| Rule bundle id (new quotes) | Prefix `fp-finance-0.1.0:` from `FINANCE_PRICING_RULES_ID` in `parity-helpers.ts`. | Older rows may still show retired `fp-shadow-0.1.0:` — treat as immutable history only. |
| Extra logging | `shadowLogOnly` logs inputs + quote; **does not** change totals. | Drift monitoring only. |

**Code anchors:** `registration-quote.application.service.ts`, `pricing-engine.service.ts`, `calculate-quote.ts`, `parity-helpers.ts`.

## Ledger

| Concern | Authoritative path |
|--------|---------------------|
| Leader payment / booking wallet | `BookingLedgerAuthorityService` → `emitFinanceLedgerDoubleEntryAppliedOutbox` (`finance.ledger.double_entry_applied`). |
| Refunds | `PaymentRefundLedgerAuthorityService` → same outbox pattern. |
| Payments capture path | `PaymentsService` wires finance ledger authority (no parallel in-memory “shadow ledger” for production money). |

**Code anchors:** `booking-ledger-authority.service.ts`, `payment-refund-ledger-authority.service.ts`, `emit-finance-ledger-journal-outbox.ts`, `registrations.service.ts`.

## Reconciliation

Payment–finance reconciliation (`PaymentFinanceReconciliationService`) correlates PSP outbox, `payments`, booking price snapshots, and **ledger lines parsed from** `finance.ledger.double_entry_applied` — aligned with authoritative outbox facts, not a duplicate shadow store.

## Operational checklist

1. **Do not** enable `financeShadowCompare` on hot registration/checkout paths unless intentionally measuring drift.
2. When bumping rule semantics, bump `FINANCE_PRICING_RULES_ID` and document the change; expect mixed `pricing_rule_version` prefixes across historical registrations until data ages out.
