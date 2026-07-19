import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/**
 * Fake WS4 offline receipt defaults — distinct from Denali IRR, WS2 USD, WS3 EUR.
 */
export class FinanceWs4ReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "7500",
      currency: "GBP",
    };
  }
}
