/**
 * Durable detection helpers — Paid ⇒ ledger capture outbox row.
 * Domain event id formula is fixed (Phase 3B); do not change.
 */
export function paymentLedgerCaptureDomainEventId(paymentId: string): string {
  const id = paymentId.trim();
  return `payment:${id}:ledger-capture-anchor`;
}

export type PaidPaymentProbeRow = {
  readonly id: string;
  readonly tenantId: string;
  readonly status: string;
  readonly paidAt: Date | null;
};

export type LedgerCaptureOutboxProbeRow = {
  readonly tenantId: string;
  readonly domainEventId: string;
  readonly eventType: string;
};

/**
 * Count Paid payments (optionally since `since`) missing their capture outbox row.
 * Mirrors `finance_reconciliation_mismatch` scrape semantics.
 */
export function countPaidWithoutLedgerCapture(input: {
  readonly payments: readonly PaidPaymentProbeRow[];
  readonly outbox: readonly LedgerCaptureOutboxProbeRow[];
  readonly since?: Date;
}): number {
  const captureKeys = new Set(
    input.outbox
      .filter((row) => row.eventType === "finance.ledger.double_entry_applied")
      .map((row) => `${row.tenantId}\0${row.domainEventId}`)
  );
  let count = 0;
  for (const payment of input.payments) {
    if (payment.status !== "Paid" || payment.paidAt === null) {
      continue;
    }
    if (input.since !== undefined && payment.paidAt <= input.since) {
      continue;
    }
    const key = `${payment.tenantId}\0${paymentLedgerCaptureDomainEventId(payment.id)}`;
    if (!captureKeys.has(key)) {
      count += 1;
    }
  }
  return count;
}
