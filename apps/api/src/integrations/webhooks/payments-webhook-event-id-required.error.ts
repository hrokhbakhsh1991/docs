export class PaymentsWebhookEventIdRequiredError extends Error {
  readonly code = "PAYMENTS_WEBHOOK_EVENT_ID_REQUIRED" as const;
  readonly statusCode = 400 as const;

  constructor(message = "Payments webhook eventId is required for replay protection") {
    super(message);
    this.name = "PaymentsWebhookEventIdRequiredError";
  }
}

export function isPaymentsWebhookEventIdRequiredError(
  error: unknown
): error is PaymentsWebhookEventIdRequiredError {
  return error instanceof PaymentsWebhookEventIdRequiredError;
}
