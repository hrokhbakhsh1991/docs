/**
 * Kind of reconciliation run (PSP / bank / internal triad). Persisted on {@link ReconciliationJobEntity}.
 */
export enum ReconciliationJobKind {
  /** Payment vs ledger vs booking snapshot triad (current worker). */
  PAYMENT_FINANCE = "payment_finance",
  /** Future: PSP settlement file batch. */
  PSP_SETTLEMENT = "psp_settlement",
  /** Future: bank feed / MT940 style. */
  BANK_FEED = "bank_feed"
}
