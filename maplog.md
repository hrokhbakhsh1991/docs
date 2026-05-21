# DETAILED ENTERPRISE FINANCIAL AUDIT & REFACTOR SPECIFICATION (PHASE 12.6+)
Goal: Achieve absolute structural safety, zero-sum verification, and elimination of multi-currency poisoning and deadlock traps across all financial layers.

---

## SECTION 1: COMPOSITE KEY EXPANSION & MULTI-CURRENCY POISONING PURGE
Target Files:
- `apps/api/src/modules/finance/ledger/entities/account-balance.entity.ts`
- `apps/api/src/modules/finance/ledger/persist-ledger-journal.ts`
- `apps/api/src/modules/finance/ledger/wallet-projection.ts`

### Meticulous Checkpoints:
- [ ] **1.1: Migration Execution**
  - Drop the old primary key constraint `PK_account_balances` on `(tenant_id, account)`.
  - Re-create the Primary Key as a strict triple composite key: `PRIMARY KEY ("tenant_id", "account", "currency")`.
- [ ] **1.2: Entity Refactor**
  - Update `AccountBalanceEntity` to explicitly mark `currency` with `@PrimaryColumn("varchar", { length: 8 })`.
- [ ] **1.3: UPSERT Statement Re-write**
  - Locate the raw SQL query inside `persistLedgerJournal` (around lines 60-74).
  - Change the `ON CONFLICT` target array to: `ON CONFLICT (tenant_id, account, currency)`.
  - Ensure `balance_minor` accumulates values *only* when the currency tokens match 100%.
- [ ] **1.4: Read Path Scope Update**
  - Update `calculateWalletBalance` in `wallet-projection.ts`. Ensure queries hitting `AccountBalanceEntity` pass `currency` in the `where` clause if fetching a single currency balance, preventing mixed-currency leakages.

---

## SECTION 2: GLOBAL TRANSACTION LOCK ORDERING (ANTI-DEADLOCK 40P01)
Target Files:
- `apps/api/src/modules/registrations/registrations.service.ts`
- `apps/api/src/modules/finance/receipts/receipt.service.ts`
- `apps/api/src/modules/payments/payments.service.ts`

### Meticulous Checkpoints:
- [ ] **2.1: Audit Inverted Locking Sequences**
  - Map every database mutation thread that touches `TourEntity`, `RegistrationEntity`, and `PaymentEntity` simultaneously.
- [ ] **2.2: Enforce Tour-First Pre-emptive Locking**
  - Inside `receipt.service.ts -> approveReceipt()`, BEFORE acquiring the registration lock, pre-emptively load and lock the parent `TourEntity` row using `.setLock("pessimistic_write")` via `requireTourInTenantForUpdate`.
  - Inside `payments.service.ts -> applyPaymentStatus()` (automated webhook flow), force the exact same Tour-First lock before calling `lockRegistrationForFinancialMutation`.
- [ ] **2.3: Fix Registration Update Lost-Update Surface**
  - Locate `updateRegistrationStatus` in `registrations.service.ts` (lines 594-638).
  - Replace the un-locked `manager.findOne` with an explicit `pessimistic_write` lock to prevent interleaved state overrides.

---

## SECTION 3: REFACTOR INTEGRITY ANCHORS & JOURNAL HEADER (TASK 12.6.4)
Target Files:
- `apps/api/src/modules/finance/ledger/entities/ledger-journal-batch.entity.ts` (New)
- `apps/api/src/modules/finance/ledger/persist-ledger-journal.ts`
- `apps/api/src/modules/payments/entities/payment.entity.ts`
- `apps/api/src/modules/finance/receipts/entities/payment-receipt.entity.ts`

### Meticulous Checkpoints:
- [ ] **3.1: Construct Journal Header Schema**
  - Create the `ledger_journal_batches` entity. Columns: `tenant_id` (UUID), `journal_id` (UUID, Primary Key), `created_at` (TIMESTAMPTZ). 
  - Ensure a unique composite constraint exists on `("tenant_id", "journal_id")`.
- [ ] **3.2: Atomic Header Injection**
  - Modify `persistLedgerJournal`. Before appending lines into `ledger_journal_lines`, create and save a unique single header row inside `ledger_journal_batches`.
- [ ] **3.3: Referential Database-Level Foreign Keys**
  - Alter `payments` and `payment_receipts` schemas. Add a structural database composite Foreign Key constraint pointing directly to `ledger_journal_batches("tenant_id", "journal_id")`.

---

## SECTION 4: GRANULAR EDGE-CASES (REFUNDS, DISCOUNTS & CLEARING BALANCES)
Target Files:
- `apps/api/src/modules/finance/ledger/payment-refund-ledger-authority.service.ts`
- `apps/api/src/modules/finance/ledger/booking-ledger-authority.service.ts`
- `apps/api/src/modules/finance/reconciliation/payment-finance-reconciliation.loader.ts`

### Meticulous Checkpoints:
- [ ] **4.1: Double-Refund Reversal Protection**
  - Inspect `PaymentRefundLedgerAuthorityService`. Enforce that when a refund action triggers, it checks the target `payment.ledger_journal_id` first.
  - Generate deterministic idempotency keys for refund reversals (`payment:${id}:refund-reversal-anchor`) to neutralize double-clicking risks.
- [ ] **4.2: Abstract Adjustments & Credit Notes**
  - Audit how manual operator discounts or price updates affect ledger facts. Ensure any price delta triggers an offset double-entry journal entry to `gl:discount-adjustments` instead of mutating the historical `booking_price_snapshots` table.
- [ ] **4.3: Zero-Sum Invariant Validation for Clearing Accounts**
  - In `payment-finance-reconciliation.loader.ts`, add an internal compilation script to ensure that across any specific tenant context, the absolute sum of Debits and Credits within `gl:leader-registration-payment-clearing` resolves perfectly to zero after batch deliveries.
- [ ] **4.4: Remove Type-Coercion Functions**
  - Strip all instances of `Number(paymentAmountToLedgerMinorString(...))` and replace them with native string/BigInt passes to prevent precision truncation on high-value transactions.

---

## SECTION 5: FINAL QUALITY GATE & COMPILATION CHECKS
- [ ] **5.1: Run Build Check**: `pnpm --filter @apps/api exec tsc --noEmit` must return exit code 0.
- [ ] **5.2: Run Ledger Guard**: `node scripts/check-ledger-only-money.mjs` must confirm zero direct mutations.
- [ ] **5.3: Run Unit Suite**: Execute all 551+ backend API tests to ensure no transaction scopes or integrations are compromised.