import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/**
 * Finance-ws5 offline receipt defaults — CAD product defaults (distinct from Denali IRR).
 */
export class FinanceWs5ReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "12500",
      currency: "CAD",
    };
  }
}
