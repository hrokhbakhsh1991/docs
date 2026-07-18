import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "@app-tour/finance-http-contracts";

/**
 * Denali offline receipt defaults — values preserved from prior FinanceService literals.
 */
export class DenaliFinanceReceiptDefaultsAdapter implements FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults {
    return {
      amountMinor: "2500000",
      currency: "IRR",
    };
  }
}
