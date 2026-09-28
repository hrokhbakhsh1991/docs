/**
 * Payment holds are actionable only for approved, unsettled registrations.
 * Treat stale holds as non-displayable instead of leaking a deadline after
 * payment approval or a waived obligation.
 */
export function resolvePaymentDueAtForProjection(record: {
  readonly status: string;
  readonly paymentStatus: string;
  readonly financialDisplayState?: string;
  readonly paymentDueAt?: string | null;
}): string | undefined {
  if (record.status !== "approved") return undefined;
  if (record.paymentStatus === "paid") return undefined;
  if (record.financialDisplayState === "WAIVED") return undefined;
  if (typeof record.paymentDueAt !== "string" || record.paymentDueAt.trim().length === 0) {
    return undefined;
  }
  return record.paymentDueAt;
}
