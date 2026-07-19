import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/**
 * Fake WS3 offline receipt defaults — distinct from Denali IRR and WS2 USD/10000.
 */
export class FinanceWs3ReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "5000",
      currency: "EUR",
    };
  }
}
