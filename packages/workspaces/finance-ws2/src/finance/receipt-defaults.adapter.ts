import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/**
 * Fake WS2 offline receipt defaults — deliberately distinct from Denali IRR / 2500000.
 */
export class FinanceWs2ReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "10000",
      currency: "USD",
    };
  }
}
