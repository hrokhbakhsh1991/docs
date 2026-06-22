export class StripeSecretKeyNotConfiguredError extends Error {
  readonly code = "STRIPE_SECRET_KEY_NOT_CONFIGURED" as const;
  readonly statusCode = 503 as const;

  constructor(message = "STRIPE_SECRET_KEY env is required for Stripe Connect v2") {
    super(message);
    this.name = "StripeSecretKeyNotConfiguredError";
  }
}

export class StripeConnectV2RequestFailedError extends Error {
  readonly code = "STRIPE_CONNECT_V2_REQUEST_FAILED" as const;
  readonly statusCode = 502 as const;

  constructor(
    readonly endpoint: string,
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "StripeConnectV2RequestFailedError";
  }
}

export function isStripeSecretKeyNotConfiguredError(
  error: unknown
): error is StripeSecretKeyNotConfiguredError {
  return error instanceof StripeSecretKeyNotConfiguredError;
}

export function isStripeConnectV2RequestFailedError(
  error: unknown
): error is StripeConnectV2RequestFailedError {
  return error instanceof StripeConnectV2RequestFailedError;
}
