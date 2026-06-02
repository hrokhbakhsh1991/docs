# Authoritative financial cutover (P3-G)

Verification snapshot: finance **pricing** and **ledger** paths used in production registrations and payments are authoritative; legacy catalog math exists only as **read-only archive diagnostics** (gated by env, never in production).

## Pricing

| Concern | Authoritative path | Legacy / shadow (archive) |
|--------|---------------------|---------------------------|
| Registration quote & payable snapshot | `RegistrationQuoteApplicationService.buildQuoteSnapshot` → `PricingEngineService.quote` → `calculateQuote` (`modules/finance/pricing`) | `computeLegacyCatalogQuote` runs **only** when `FINANCE_LEGACY_PRICING_DIAGNOSTICS=archive`, `NODE_ENV !== "production"`, and `PricingEngineQuoteOptions.financeShadowCompare === true`. Default `FINANCE_LEGACY_PRICING_DIAGNOSTICS=off` **disables** all shadow/diff branches in `quote()` — single orchestration path. |
| Returned totals | Always from finance `PricingQuote` mapped in `financeQuoteToResult`. | Legacy output is **never** returned to callers; optional `logPricingShadowDiff` compares legacy vs finance for logs only when the archive gate is on. |
| Rule bundle id (new quotes) | Prefix `fp-finance-0.1.0:` from `FINANCE_PRICING_RULES_ID` in `parity-helpers.ts`. | Older rows may still show retired `fp-shadow-0.1.0:` — treat as immutable history only. |
| Extra logging | `shadowLogOnly` logs inputs + quote; **does not** change totals. | Same archive gate as `financeShadowCompare`. |

**Code anchors:** `registration-quote.application.service.ts`, `pricing-engine.service.ts`, `calculate-quote.ts`, `parity-helpers.ts`, `config.service.ts` (`getFinanceLegacyPricingDiagnosticsMode`).

## Payments (single spine)

| Concern | Authoritative path |
|--------|---------------------|
| Intents, webhooks, refunds, timeouts | `modules/payments` (`PaymentsService`, `PaymentsProcessor`) — the HTTP/orchestration surface; capture paths invoke finance ledger authority (no in-memory shadow ledger). |
| Money journal lines | `BookingLedgerAuthorityService` / `PaymentRefundLedgerAuthorityService` → `finance.ledger.double_entry_applied` outbox events. |
| Gateway idempotency (process-level) | `PAYMENT_GATEWAY_IDEMPOTENCY_STORE` defaults to **`postgres`** (table `payment_gateway_idempotency`, cross-replica + crash-safe). Optional `redis`; `memory` only for tests / single process. PSP-native keys (e.g. Stripe `Idempotency-Key`) remain in gateway clients where supported. |

There is **no** parallel “shadow payments” store; reconciliation reads PSP + `payments` + snapshots + ledger outbox facts only.

## Ledger

| Concern | Authoritative path |
|--------|---------------------|
| Leader payment / booking wallet | `BookingLedgerAuthorityService` → `emitFinanceLedgerDoubleEntryAppliedOutbox` (`finance.ledger.double_entry_applied`). |
| Refunds | `PaymentRefundLedgerAuthorityService` → same outbox pattern. |

**Code anchors:** `booking-ledger-authority.service.ts`, `payment-refund-ledger-authority.service.ts`, `emit-finance-ledger-journal-outbox.ts`, `registrations.service.ts`, `postgres-payment-idempotency-key.store.ts`.

## Reconciliation

Payment–finance reconciliation (`PaymentFinanceReconciliationService`) correlates PSP outbox, `payments`, booking price snapshots, and **ledger lines parsed from** `finance.ledger.double_entry_applied` — aligned with authoritative outbox facts, not a duplicate shadow store.

## Operational checklist

1. Keep `FINANCE_LEGACY_PRICING_DIAGNOSTICS=off` in production (enforced: production always treats it as `off` even if mis-set).
2. Use `archive` only on non-production hosts when intentionally measuring legacy-vs-finance drift; never pass shadow flags on hot paths from clients.
3. When bumping rule semantics, bump `FINANCE_PRICING_RULES_ID` and document the change; expect mixed `pricing_rule_version` prefixes across historical registrations until data ages out.
