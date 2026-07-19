import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/**
 * Fake WS5 offline receipt defaults — distinct from Denali/WS2/WS3/WS4.
 */
export class FinanceWs5ReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "12500",
      currency: "CAD",
    };
  }
}
