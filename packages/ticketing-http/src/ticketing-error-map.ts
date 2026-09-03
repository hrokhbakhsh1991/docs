import type { TicketingDomainError, TicketingErrorCode } from "@app-tour/ticketing-core";

const DOMAIN_HTTP_STATUS: Partial<Record<TicketingErrorCode, number>> = {
  TICKET_NOT_FOUND: 404,
  TICKET_ACCESS_DENIED: 404,
  MEMBER_TICKET_OWNERSHIP_REQUIRED: 404,
  TICKET_CLOSED: 409,
  INVALID_STATUS_TRANSITION: 409,
  ROW_VERSION_CONFLICT: 409,
  DUPLICATE_COMMAND: 409,
  TICKET_VIEWER_READ_ONLY: 403,
  INTERNAL_NOTE_FORBIDDEN: 403,
  TICKET_MODULE_DISABLED: 404,
  ASSIGNEE_NOT_IN_TENANT: 422,
  INVALID_CATEGORY_CODE: 422,
  INVALID_SUBJECT: 422,
  INVALID_BODY: 422,
  INVALID_STATUS: 422,
  INVALID_PRIORITY: 422,
  INVALID_VISIBILITY: 422,
  INVALID_TICKET_ACTOR: 403,
  TENANT_CONTEXT_REQUIRED: 401,
};

const DOMAIN_HTTP_CODE: Partial<Record<TicketingErrorCode, string>> = {
  TICKET_NOT_FOUND: "TICKET_NOT_FOUND",
  TICKET_ACCESS_DENIED: "TICKET_NOT_FOUND",
  MEMBER_TICKET_OWNERSHIP_REQUIRED: "TICKET_NOT_FOUND",
  TICKET_CLOSED: "TICKET_CLOSED",
  INVALID_STATUS_TRANSITION: "TICKET_INVALID_TRANSITION",
  ROW_VERSION_CONFLICT: "TICKET_VERSION_CONFLICT",
  DUPLICATE_COMMAND: "TICKET_VERSION_CONFLICT",
  TICKET_VIEWER_READ_ONLY: "TICKET_VIEWER_READ_ONLY",
  INTERNAL_NOTE_FORBIDDEN: "FORBIDDEN_OPERATOR_FORBIDDEN",
  TICKET_MODULE_DISABLED: "TICKET_MODULE_DISABLED",
  ASSIGNEE_NOT_IN_TENANT: "TICKET_ASSIGNEE_INVALID",
  INVALID_CATEGORY_CODE: "TICKET_CATEGORY_INVALID",
};

export function mapTicketingDomainErrorToHttp(error: TicketingDomainError): {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
} {
  return {
    status: DOMAIN_HTTP_STATUS[error.code] ?? 422,
    code: DOMAIN_HTTP_CODE[error.code] ?? error.code,
    ...(error.field !== undefined ? { field: error.field } : {}),
  };
}

export function throwTicketingDomainError(error: TicketingDomainError): never {
  const mapped = mapTicketingDomainErrorToHttp(error);
  const err = new Error(mapped.code);
  (err as Error & { httpStatus: number; field?: string }).httpStatus = mapped.status;
  if (mapped.field !== undefined) {
    (err as Error & { field?: string }).field = mapped.field;
  }
  throw err;
}

export function resolveTicketingHttpError(error: unknown): {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
} | null {
  if (!(error instanceof Error)) {
    return null;
  }
  const code = error.message;
  if (code === "IDEMPOTENCY_KEY_REQUIRED" || code.startsWith("ZOD_VALIDATION_FAILED")) {
    return {
      status: code === "IDEMPOTENCY_KEY_REQUIRED" ? 422 : 422,
      code: code === "IDEMPOTENCY_KEY_REQUIRED" ? "IDEMPOTENCY_KEY_REQUIRED" : "ZOD_VALIDATION_FAILED",
    };
  }
  if (code === "FORBIDDEN_OPERATOR_ENDPOINT") {
    return { status: 403, code: "FORBIDDEN_OPERATOR_FORBIDDEN" };
  }
  if (code === "ROW_VERSION_CONFLICT") {
    return { status: 409, code: "TICKET_VERSION_CONFLICT" };
  }
  const httpStatus = (error as Error & { httpStatus?: number }).httpStatus;
  if (httpStatus !== undefined) {
    return {
      status: httpStatus,
      code,
      ...((error as Error & { field?: string }).field !== undefined
        ? { field: (error as Error & { field?: string }).field }
        : {}),
    };
  }
  return null;
}
