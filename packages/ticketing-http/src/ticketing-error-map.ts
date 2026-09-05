import type { TicketingDomainError, TicketingErrorCode } from "@app-tour/ticketing-core";

const DOMAIN_HTTP_STATUS: Partial<Record<TicketingErrorCode, number>> = {
  TICKET_NOT_FOUND: 404,
  TICKET_ACCESS_DENIED: 404,
  MEMBER_TICKET_OWNERSHIP_REQUIRED: 404,
  TICKET_CLOSED: 409,
  TICKET_ON_HOLD: 409,
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
  DUPLICATE_TAG: 409,
  TAG_NOT_FOUND: 404,
  QUEUE_NOT_FOUND: 404,
  TEAM_NOT_FOUND: 404,
  ASSIGNEE_NOT_IN_TEAM: 422,
  TICKET_ATTACHMENT_INVALID_FILE: 422,
  TICKET_ATTACHMENT_TOO_LARGE: 413,
  TICKET_ATTACHMENT_UNSUPPORTED_TYPE: 422,
  TICKET_ATTACHMENT_SCAN_REJECTED: 400,
  TICKET_ATTACHMENT_NOT_FOUND: 404,
  TICKET_ENTITY_NOT_FOUND: 404,
  TICKET_ENTITY_CROSS_TENANT: 404,
  TICKET_LINK_DUPLICATE: 409,
  TICKET_ATTACHMENTS_DISABLED: 404,
  TICKET_STORAGE_UNAVAILABLE: 503,
};

const DOMAIN_HTTP_CODE: Partial<Record<TicketingErrorCode, string>> = {
  TICKET_NOT_FOUND: "TICKET_NOT_FOUND",
  TICKET_ACCESS_DENIED: "TICKET_NOT_FOUND",
  MEMBER_TICKET_OWNERSHIP_REQUIRED: "TICKET_NOT_FOUND",
  TICKET_CLOSED: "TICKET_CLOSED",
  TICKET_ON_HOLD: "TICKET_ON_HOLD",
  INVALID_STATUS_TRANSITION: "TICKET_INVALID_TRANSITION",
  ROW_VERSION_CONFLICT: "TICKET_VERSION_CONFLICT",
  DUPLICATE_COMMAND: "TICKET_VERSION_CONFLICT",
  TICKET_VIEWER_READ_ONLY: "TICKET_VIEWER_READ_ONLY",
  INTERNAL_NOTE_FORBIDDEN: "FORBIDDEN_OPERATOR_FORBIDDEN",
  TICKET_MODULE_DISABLED: "TICKET_MODULE_DISABLED",
  ASSIGNEE_NOT_IN_TENANT: "TICKET_ASSIGNEE_INVALID",
  INVALID_CATEGORY_CODE: "TICKET_CATEGORY_INVALID",
  DUPLICATE_TAG: "TICKET_DUPLICATE_TAG",
  TAG_NOT_FOUND: "TICKET_TAG_NOT_FOUND",
  QUEUE_NOT_FOUND: "TICKET_QUEUE_NOT_FOUND",
  TEAM_NOT_FOUND: "TICKET_TEAM_NOT_FOUND",
  ASSIGNEE_NOT_IN_TEAM: "TICKET_ASSIGNEE_NOT_IN_TEAM",
  TICKET_ATTACHMENT_INVALID_FILE: "TICKET_ATTACHMENT_INVALID_FILE",
  TICKET_ATTACHMENT_TOO_LARGE: "TICKET_ATTACHMENT_TOO_LARGE",
  TICKET_ATTACHMENT_UNSUPPORTED_TYPE: "TICKET_ATTACHMENT_UNSUPPORTED_TYPE",
  TICKET_ATTACHMENT_SCAN_REJECTED: "TICKET_ATTACHMENT_SCAN_REJECTED",
  TICKET_ATTACHMENT_NOT_FOUND: "TICKET_ATTACHMENT_NOT_FOUND",
  TICKET_ENTITY_NOT_FOUND: "TICKET_ENTITY_NOT_FOUND",
  TICKET_ENTITY_CROSS_TENANT: "TICKET_ENTITY_CROSS_TENANT",
  TICKET_LINK_DUPLICATE: "TICKET_LINK_DUPLICATE",
  TICKET_ATTACHMENTS_DISABLED: "TICKET_MODULE_DISABLED",
  TICKET_STORAGE_UNAVAILABLE: "TICKET_STORAGE_UNAVAILABLE",
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
  if (
    code === "TICKETING_WORKSPACE_UNSUPPORTED" ||
    code === "FORBIDDEN_TICKETING_MODULE_DISABLED"
  ) {
    return { status: 404, code: "TICKET_MODULE_DISABLED" };
  }
  // ZOD_VALIDATION_FAILED and IDEMPOTENCY_KEY_REQUIRED are handled by the API
  // error interceptor (400). Ticketing BFF routes map their own 422 envelopes.
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
