/** Resolved PSP credentials for a tenant + provider (tenant row merged with platform env fallback). */
export type ResolvedStripeCredentials = {
  secretKey: string;
};

export type ResolvedZibalCredentials = {
  merchantId: string;
  callbackUrl: string;
};

export type ResolvedPaymentGatewayCredentials =
  | { provider: "stripe"; stripe: ResolvedStripeCredentials }
  | { provider: "zibal"; zibal: ResolvedZibalCredentials }
  | { provider: "mock" };
