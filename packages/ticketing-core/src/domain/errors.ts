/**
 * Ticketing domain error model — machine-readable, fail-closed (TKT-001 Phase 2).
 */

export const TICKETING_ERROR_CODES = [
  "TICKET_NOT_FOUND",
  "TICKET_CLOSED",
  "INVALID_STATUS_TRANSITION",
  "INVALID_PRIORITY",
  "TICKET_ACCESS_DENIED",
  "INTERNAL_NOTE_FORBIDDEN",
  "MEMBER_TICKET_OWNERSHIP_REQUIRED",
  "ASSIGNEE_NOT_IN_TENANT",
  "ROW_VERSION_CONFLICT",
  "INVALID_TICKET_ACTOR",
  "TENANT_CONTEXT_REQUIRED",
  "TICKET_VIEWER_READ_ONLY",
  "TICKET_MODULE_DISABLED",
  "INVALID_CATEGORY_CODE",
  "INVALID_SUBJECT",
  "INVALID_BODY",
  "INVALID_STATUS",
  "INVALID_VISIBILITY",
  "DUPLICATE_COMMAND",
  "DUPLICATE_TAG",
  "TAG_NOT_FOUND",
  "QUEUE_NOT_FOUND",
  "TEAM_NOT_FOUND",
  "ASSIGNEE_NOT_IN_TEAM",
] as const;

export type TicketingErrorCode = (typeof TICKETING_ERROR_CODES)[number];

export type TicketingDomainError = {
  readonly code: TicketingErrorCode;
  readonly message: string;
  readonly field?: string;
};

export type TicketingResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: TicketingDomainError };

export function ticketingOk<T>(value: T): TicketingResult<T> {
  return { ok: true, value };
}

export function ticketingErr<T>(
  code: TicketingErrorCode,
  message: string,
  field?: string,
): TicketingResult<T> {
  return { ok: false, error: { code, message, ...(field !== undefined ? { field } : {}) } };
}

export function isTicketingErrorCode(value: string): value is TicketingErrorCode {
  return (TICKETING_ERROR_CODES as readonly string[]).includes(value);
}

export class TicketLifecycleError extends Error {
  readonly code: TicketingErrorCode;
  readonly from?: string;
  readonly to?: string;

  constructor(
    code: TicketingErrorCode,
    message: string,
    options?: { from?: string; to?: string },
  ) {
    super(message);
    this.name = "TicketLifecycleError";
    this.code = code;
    this.from = options?.from;
    this.to = options?.to;
  }
}
