/**
 * Stable ticketing HTTP error envelope — TKT-001 Phase 1.
 */

export const TICKETING_HTTP_ERROR_CODES = [
  "TICKET_NOT_FOUND",
  "TICKET_CLOSED",
  "TICKET_VIEWER_READ_ONLY",
  "TICKET_VERSION_CONFLICT",
  "TICKET_INVALID_TRANSITION",
  "TICKET_ASSIGNEE_INVALID",
  "TICKET_CATEGORY_INVALID",
  "TICKET_STORAGE_UNAVAILABLE",
  "TICKET_MODULE_DISABLED",
  "FORBIDDEN_OPERATOR_FORBIDDEN",
  "IDEMPOTENCY_KEY_REQUIRED",
  "ZOD_VALIDATION_FAILED",
] as const;

export type TicketingHttpErrorCode = (typeof TICKETING_HTTP_ERROR_CODES)[number];

export type TicketingHttpErrorResponse = {
  readonly error: string;
  readonly code: TicketingHttpErrorCode | string;
  readonly correlationId?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
};

export function isTicketingHttpErrorCode(value: string): value is TicketingHttpErrorCode {
  return (TICKETING_HTTP_ERROR_CODES as readonly string[]).includes(value);
}
