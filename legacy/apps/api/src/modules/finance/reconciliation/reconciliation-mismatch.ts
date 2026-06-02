/**
 * A single detected inconsistency between PSP-reported money, append-only ledger facts,
 * and the immutable booking pricing snapshot (see `BookingPriceSnapshot` / `computed_total_minor`).
 *
 * **No bank parsing** — amounts are already normalized minor-unit strings + ISO currency.
 */
export type ReconciliationMismatch = {
  readonly id: string;
  readonly tenantId: string;
  readonly bookingId: string;
  readonly currency: string;
  readonly psp_amount_minor: string;
  readonly ledger_amount_minor: string;
  readonly booking_snapshot_amount_minor: string;
  /** `psp - ledger` in minor units (string for JSON logs). */
  readonly delta_psp_vs_ledger_minor: string;
  /** `psp - booking_snapshot` */
  readonly delta_psp_vs_snapshot_minor: string;
  /** `ledger - booking_snapshot` */
  readonly delta_ledger_vs_snapshot_minor: string;
  readonly detectedAt: string;
  readonly reason: ReconciliationMismatchReason;
};

export enum ReconciliationMismatchReason {
  AMOUNT_TRIAD_MISMATCH = "amount_triad_mismatch",
  CURRENCY_INCONSISTENT = "currency_inconsistent",
  INVALID_AMOUNT_FORMAT = "invalid_amount_format"
}
