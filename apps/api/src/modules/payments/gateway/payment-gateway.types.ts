/** Inputs for a provider-agnostic “create intent” call (no client-supplied final paid state). */
export type CreatePaymentIntentGatewayInput = {
  tenantId: string;
  /** Caller-supplied idempotency key (e.g. header); required for every mutation. */
  idempotencyKey: string;
  amount: number;
  currency: string;
  registrationId: string;
  metadata?: Record<string, string>;
};

export type PaymentIntentGatewayResult = {
  provider: string;
  providerPaymentId: string;
  /** Stripe-shaped hook for future client SDKs; placeholder only today. */
  clientSecret?: string;
  /** Zibal (and similar) redirect URL for the payer’s browser. */
  checkoutUrl?: string;
  status: "requires_payment_method" | "processing" | "succeeded" | "canceled";
};
