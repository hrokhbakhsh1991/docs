import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/** Fake WS6 offline receipt defaults — AUD, distinct from prior fixtures. */
export class FinanceWs6ReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "9900",
      currency: "AUD",
    };
  }
}
