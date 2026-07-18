/**
 * Workspace-supplied defaults for member offline receipt auto-created payments.
 * Wired at boot — FinanceService must not hardcode currency/amount by workspace.
 */
export type FinanceOfflineReceiptDefaults = {
  readonly amountMinor: string;
  readonly currency: string;
};

export interface FinanceReceiptDefaultsPort {
  offlineReceiptPaymentDefaults(): FinanceOfflineReceiptDefaults;
}
