export class PaymentsWebhookSigningSecretNotConfiguredError extends Error {
  readonly code = "PAYMENTS_WEBHOOK_SIGNING_SECRET_NOT_CONFIGURED" as const;
  readonly statusCode = 503 as const;

  constructor(message = "PAYMENTS_WEBHOOK_SIGNING_SECRET env is required") {
    super(message);
    this.name = "PaymentsWebhookSigningSecretNotConfiguredError";
  }
}

export class PaymentsWebhookSignatureMissingError extends Error {
  readonly code = "PAYMENTS_WEBHOOK_SIGNATURE_MISSING" as const;
  readonly statusCode = 401 as const;

  constructor(message = "Payments webhook signature headers are required") {
    super(message);
    this.name = "PaymentsWebhookSignatureMissingError";
  }
}

export class PaymentsWebhookTimestampSkewError extends Error {
  readonly code = "PAYMENTS_WEBHOOK_TIMESTAMP_SKEW" as const;
  readonly statusCode = 401 as const;

  constructor(message = "Payments webhook timestamp outside allowed skew") {
    super(message);
    this.name = "PaymentsWebhookTimestampSkewError";
  }
}

export class PaymentsWebhookSignatureInvalidError extends Error {
  readonly code = "PAYMENTS_WEBHOOK_SIGNATURE_INVALID" as const;
  readonly statusCode = 401 as const;

  constructor(message = "Payments webhook signature verification failed") {
    super(message);
    this.name = "PaymentsWebhookSignatureInvalidError";
  }
}

export class PaymentsWebhookSourceIpBlockedError extends Error {
  readonly code = "PAYMENTS_WEBHOOK_SOURCE_IP_BLOCKED" as const;
  readonly statusCode = 403 as const;

  constructor(message = "Payments webhook source IP is not allowlisted") {
    super(message);
    this.name = "PaymentsWebhookSourceIpBlockedError";
  }
}

export function isPaymentsWebhookSigningSecretNotConfiguredError(
  error: unknown
): error is PaymentsWebhookSigningSecretNotConfiguredError {
  return error instanceof PaymentsWebhookSigningSecretNotConfiguredError;
}

export function isPaymentsWebhookSignatureMissingError(
  error: unknown
): error is PaymentsWebhookSignatureMissingError {
  return error instanceof PaymentsWebhookSignatureMissingError;
}

export function isPaymentsWebhookTimestampSkewError(
  error: unknown
): error is PaymentsWebhookTimestampSkewError {
  return error instanceof PaymentsWebhookTimestampSkewError;
}

export function isPaymentsWebhookSignatureInvalidError(
  error: unknown
): error is PaymentsWebhookSignatureInvalidError {
  return error instanceof PaymentsWebhookSignatureInvalidError;
}

export function isPaymentsWebhookSourceIpBlockedError(
  error: unknown
): error is PaymentsWebhookSourceIpBlockedError {
  return error instanceof PaymentsWebhookSourceIpBlockedError;
}
