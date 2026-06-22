export class ZibalMerchantNotConfiguredError extends Error {
  readonly code = "ZIBAL_MERCHANT_NOT_CONFIGURED" as const;
  readonly statusCode = 503 as const;

  constructor(message = "ZIBAL_MERCHANT env is required for gateway requests") {
    super(message);
    this.name = "ZibalMerchantNotConfiguredError";
  }
}

export class ZibalPaymentRequestFailedError extends Error {
  readonly code = "ZIBAL_PAYMENT_REQUEST_FAILED" as const;
  readonly statusCode = 502 as const;

  constructor(
    readonly result: number,
    readonly trackId: string | null,
    message = `Zibal request failed with result ${result}`
  ) {
    super(message);
    this.name = "ZibalPaymentRequestFailedError";
  }
}

export function isZibalMerchantNotConfiguredError(
  error: unknown
): error is ZibalMerchantNotConfiguredError {
  return error instanceof ZibalMerchantNotConfiguredError;
}

export function isZibalPaymentRequestFailedError(
  error: unknown
): error is ZibalPaymentRequestFailedError {
  return error instanceof ZibalPaymentRequestFailedError;
}
