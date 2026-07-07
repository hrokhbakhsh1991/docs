export const PAYMENTS_WEBHOOK_PATH = "/internal/payments/webhook" as const;

export const PAYMENTS_WEBHOOK_SIGNATURE_HEADER = "x-payments-webhook-signature" as const;

export const PAYMENTS_WEBHOOK_TIMESTAMP_HEADER = "x-payments-webhook-timestamp" as const;

export const PAYMENTS_WEBHOOK_EVENT_ID_HEADER = "x-payments-webhook-event-id" as const;

/** ±5 minutes — frozen WH-01 skew window. */
export const PAYMENTS_WEBHOOK_MAX_SKEW_MS = 5 * 60 * 1000;
