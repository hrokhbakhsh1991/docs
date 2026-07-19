/** Finance recon finding codes — FINANCE_RECONCILIATION_DESIGN §2. */

export const FINANCE_RECON_CODE = {
  paidNoLedger: "D-PAID-NO-LEDGER",
  ledgerNoPayment: "D-LEDGER-NO-PAYMENT",
  paidAmtMismatch: "D-PAID-AMT-MISMATCH",
  dupCapture: "D-DUP-CAPTURE",
  prepayNoLedger: "D-PREPAY-NO-LEDGER",
  paidBookingDrift: "D-PAID-BOOKING-DRIFT",
  prepayBookingDegraded: "D-PREPAY-BOOKING-DEGRADED",
  outboxFailed: "D-OUTBOX-FAILED",
  outboxStale: "D-OUTBOX-STALE",
  stuckPending: "D-STUCK-PENDING",
  doubleWallet: "D-DOUBLE-WALLET",
} as const;

export type FinanceReconCode = (typeof FINANCE_RECON_CODE)[keyof typeof FINANCE_RECON_CODE];

export const FINANCE_RECON_SEVERITY: Record<
  FinanceReconCode,
  "critical" | "high" | "medium" | "info"
> = {
  [FINANCE_RECON_CODE.paidNoLedger]: "critical",
  [FINANCE_RECON_CODE.ledgerNoPayment]: "critical",
  [FINANCE_RECON_CODE.paidAmtMismatch]: "critical",
  [FINANCE_RECON_CODE.dupCapture]: "critical",
  [FINANCE_RECON_CODE.prepayNoLedger]: "critical",
  [FINANCE_RECON_CODE.paidBookingDrift]: "high",
  [FINANCE_RECON_CODE.prepayBookingDegraded]: "medium",
  [FINANCE_RECON_CODE.outboxFailed]: "high",
  [FINANCE_RECON_CODE.outboxStale]: "medium",
  [FINANCE_RECON_CODE.stuckPending]: "medium",
  [FINANCE_RECON_CODE.doubleWallet]: "info",
};

export type FinanceReconJobId = "R1" | "R2" | "R3" | "R4" | "R5" | "R6" | "ALL";

export type FinanceReconFindingDraft = {
  readonly tenantId: string;
  readonly code: FinanceReconCode;
  readonly fingerprint: string;
  readonly paymentId?: string;
  readonly registrationId?: string;
  readonly outboxEventId?: string;
  readonly details: Record<string, unknown>;
};
