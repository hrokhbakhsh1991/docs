import type {
  FinanceOfflineReceiptDefaults,
  FinanceReceiptDefaultsPort,
} from "../ports/finance-receipt-defaults.port";

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
