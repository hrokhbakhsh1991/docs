import type { Logger } from "@nestjs/common";
import type { ReconciliationMismatch } from "./reconciliation-mismatch";

/** Canonical structured-log event name for triad mismatches (PSP vs ledger vs booking snapshot). */
export const PAYMENT_RECONCILIATION_MISMATCH = "PAYMENT_RECONCILIATION_MISMATCH" as const;

export type PaymentReconciliationMismatchLogPayload = {
  event: typeof PAYMENT_RECONCILIATION_MISMATCH;
  tenant_id: string;
  booking_id: string;
  mismatch_id: string;
  reason: string;
  currency: string;
  psp_amount_minor: string;
  ledger_amount_minor: string;
  booking_snapshot_amount_minor: string;
  delta_psp_vs_ledger_minor: string;
  delta_psp_vs_snapshot_minor: string;
  delta_ledger_vs_snapshot_minor: string;
  detected_at: string;
  reconciliation_job_id?: string;
};

export function buildPaymentReconciliationMismatchPayload(
  mismatch: ReconciliationMismatch,
  reconciliationJobId?: string
): PaymentReconciliationMismatchLogPayload {
  return {
    event: PAYMENT_RECONCILIATION_MISMATCH,
    tenant_id: mismatch.tenantId,
    booking_id: mismatch.bookingId,
    mismatch_id: mismatch.id,
    reason: mismatch.reason,
    currency: mismatch.currency,
    psp_amount_minor: mismatch.psp_amount_minor,
    ledger_amount_minor: mismatch.ledger_amount_minor,
    booking_snapshot_amount_minor: mismatch.booking_snapshot_amount_minor,
    delta_psp_vs_ledger_minor: mismatch.delta_psp_vs_ledger_minor,
    delta_psp_vs_snapshot_minor: mismatch.delta_psp_vs_snapshot_minor,
    delta_ledger_vs_snapshot_minor: mismatch.delta_ledger_vs_snapshot_minor,
    detected_at: mismatch.detectedAt,
    ...(reconciliationJobId !== undefined && reconciliationJobId !== ""
      ? { reconciliation_job_id: reconciliationJobId }
      : {})
  };
}

/**
 * Emits one JSON structured line (same pattern as `PRICING_SHADOW_DIFF`) for log processors / SIEM.
 * Pass Nest `Logger` or any `Pick<Logger, "log">` implementation.
 */
export function logPaymentReconciliationMismatch(
  logger: Pick<Logger, "log">,
  mismatch: ReconciliationMismatch,
  reconciliationJobId?: string
): void {
  logger.log(JSON.stringify(buildPaymentReconciliationMismatchPayload(mismatch, reconciliationJobId)));
}
