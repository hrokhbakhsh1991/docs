/** Outcome status for an intent lifecycle (PSP-agnostic subset). */
export type PaymentResultStatus =
  | "requires_payment_method"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

/**
 * Result of `IPaymentGateway.createPaymentIntent` (or replay via idempotency).
 * **Not** persisted by this layer — callers own DB rows (`payments`, registrations, …).
 */
export type PaymentResult = {
  status: PaymentResultStatus;
  /** Stable provider-side payment / intent identifier. */
  providerPaymentId: string;
  /** Provider slug (e.g. `fake`, future `stripe`). */
  provider: string;
  /** Optional client secret for hosted / SDK flows — **never** log in production. */
  clientSecret?: string;
  /** True when duplicate `idempotencyKey` returned cached outcome (no second PSP call). */
  idempotentReplay?: boolean;
  correlationId?: string;
};

export type RefundResultStatus = "succeeded" | "failed" | "pending";

export type RefundRequest = {
  tenantId: string;
  idempotencyKey: string;
  providerPaymentId: string;
  /** Partial refund when omitted = full (adapter-defined). */
  amountMinor?: string;
};

/**
 * Result of a refund mutation (PSP-agnostic).
 */
export type RefundResult = {
  status: RefundResultStatus;
  providerRefundId?: string;
  amountMinor?: string;
  errorCode?: string;
};
