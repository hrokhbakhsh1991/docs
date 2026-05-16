import type { PaymentRefundLedgerAuthorityService } from "../../src/modules/finance/ledger/payment-refund-ledger-authority.service";

/** Test double: skips refund ledger outbox (payments unit tests that do not assert finance events). */
export const noopPaymentRefundLedgerForTests = {
  async emitPaymentRefundLedgerReversal() {}
} as unknown as PaymentRefundLedgerAuthorityService;
