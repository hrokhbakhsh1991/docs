/** Registration-scoped payment intent snapshot (decoupled from payments module DTOs). */
export type RegistrationPaymentIntentSnapshot = {
  id: string;
  tenantId: string;
  registrationId: string;
  amount: string;
  currency: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  paidAt: string | null;
  failedAt: string | null;
  refundedAt: string | null;
  clientSecret?: string | null;
  checkoutUrl?: string | null;
};

export type RegistrationPayableRegistration = {
  id: string;
  quotedTotalMinor: string | null;
  quotedCurrencyCode: string | null;
};
