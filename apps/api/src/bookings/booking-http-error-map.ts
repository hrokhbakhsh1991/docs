/**
 * Canonical Booking domain error → HTTP status + OpenAPI wire tokens.
 * Known Booking errors must never fall through to HTTP 500.
 * Routes must not re-implement these envelopes — call handleHttpError only.
 *
 * @see docs/phase-20/p7/appendices/BOOKING_HTTP_ERROR_MATRIX.md
 */
import {
  BookingCapabilityViolationError,
  BookingNotFoundError,
  BookingPublicCreateUnsupportedError,
  BookingsOpsForbiddenError,
  BookingStatusConflictError,
  BookingWorkspaceTenantMismatchError,
  BookingWorkspaceUnsupportedError,
  BulkApproveBatchLimitError,
} from "./bookings.errors";

export type BookingHttpErrorResolution = {
  readonly status: number;
  readonly code: string;
  /** OpenAPI `error` token (stable) or domain message for capacity/validation. */
  readonly error: string;
  readonly clientAction: string;
  readonly maxBatch?: number;
};

export type BookingHttpErrorMatrixRow = {
  readonly domainError: string;
  readonly status: number;
  readonly reason: string;
  readonly clientAction: string;
};

/** Documentation + audit SoT (must stay aligned with {@link resolveBookingHttpError}). */
export const BOOKING_HTTP_ERROR_MATRIX: readonly BookingHttpErrorMatrixRow[] = [
  {
    domainError: "BOOKING_WORKSPACE_TENANT_MISMATCH",
    status: 403,
    reason: "Tenant workspaceType does not match Booking runtime",
    clientAction: "Fix tenant/runtime binding; do not retry same runtime",
  },
  {
    domainError: "BOOKING_CAPABILITY_VIOLATION",
    status: 422,
    reason: "Graded capability claim does not match adapters",
    clientAction: "Fix workspace manifest/codegen; do not retry",
  },
  {
    domainError: "BOOKING_PUBLIC_CREATE_UNSUPPORTED",
    status: 403,
    reason: "Public create disabled for this workspace",
    clientAction: "Use ops create or enable publicCreate",
  },
  {
    domainError: "BOOKING_CAPACITY_REJECTED",
    status: 409,
    reason: "Capacity / tourCapacityMax rule rejected the write",
    clientAction: "Adjust party size or capacity; do not treat as rate-limit",
  },
  {
    domainError: "BOOKING_GUEST_DUPLICATE",
    status: 409,
    reason: "Active guest already registered on this tour (MR-P0-011 unique index)",
    clientAction: "Reuse existing registration or cancel before re-registering",
  },
  {
    domainError: "BOOKING_ALREADY_APPROVED",
    status: 409,
    reason: "Booking is already approved",
    clientAction: "Treat as idempotent success; refresh booking state",
  },
  {
    domainError: "BOOKING_ALREADY_CANCELLED",
    status: 409,
    reason: "Booking is already cancelled (terminal)",
    clientAction: "Stop lifecycle writes; refresh booking state",
  },
  {
    domainError: "BOOKING_NOT_FOUND",
    status: 404,
    reason: "Booking registration not found for tenant",
    clientAction: "Verify booking id and tenant",
  },
  {
    domainError: "BOOKING_FORBIDDEN",
    status: 403,
    reason: "Caller lacks Booking ops / ownership access",
    clientAction: "Authenticate as admin or owner",
  },
  {
    domainError: "BOOKINGS_OPS_FORBIDDEN",
    status: 403,
    reason: "Caller lacks Booking ops access (legacy code alias)",
    clientAction: "Authenticate as admin or owner",
  },
  {
    domainError: "BOOKING_VALIDATION_FAILED",
    status: 400,
    reason: "Create/validation policy rejected input",
    clientAction: "Fix request body fields",
  },
  {
    domainError: "BOOKING_VALIDATION_REJECTED",
    status: 400,
    reason: "Create/validation policy rejected input (adapter message)",
    clientAction: "Fix request body fields",
  },
  {
    domainError: "BOOKING_WORKSPACE_UNSUPPORTED",
    status: 404,
    reason: "Workspace is not booking-supported",
    clientAction: "Use a booking-supported tenant/workspace",
  },
  {
    domainError: "BOOKING_STATUS_CONFLICT",
    status: 409,
    reason: "Illegal status transition",
    clientAction: "Refresh status; choose a valid transition",
  },
  {
    domainError: "BULK_APPROVE_BATCH_LIMIT",
    status: 400,
    reason: "Bulk approve batch exceeds max",
    clientAction: "Reduce ids length and retry",
  },
] as const;

const MATRIX_BY_CODE = new Map(
  BOOKING_HTTP_ERROR_MATRIX.map((row) => [row.domainError, row] as const)
);

/** Stable OpenAPI tokens used by Booking HTTP routes historically. */
const CLIENT_ERROR_TOKEN: Readonly<Record<string, string>> = {
  BOOKING_FORBIDDEN: "forbidden",
  BOOKINGS_OPS_FORBIDDEN: "forbidden",
  BOOKINGS_FORBIDDEN: "forbidden",
  BOOKING_NOT_FOUND: "not_found",
  BOOKING_ALREADY_APPROVED: "conflict",
  BOOKING_ALREADY_CANCELLED: "conflict",
  BOOKING_STATUS_CONFLICT: "conflict",
  BULK_APPROVE_BATCH_LIMIT: "batch_limit",
};

function resolutionFromCode(
  code: string,
  message: string,
  extras?: { readonly maxBatch?: number }
): BookingHttpErrorResolution | null {
  const row = MATRIX_BY_CODE.get(code === "BOOKINGS_FORBIDDEN" ? "BOOKING_FORBIDDEN" : code);
  if (row === undefined) {
    return null;
  }
  const wireCode = code === "BOOKINGS_FORBIDDEN" ? "BOOKINGS_FORBIDDEN" : row.domainError;
  const clientToken = CLIENT_ERROR_TOKEN[code] ?? CLIENT_ERROR_TOKEN[row.domainError];
  return {
    status: row.status,
    code: wireCode,
    error: clientToken ?? message,
    clientAction: row.clientAction,
    ...(extras?.maxBatch !== undefined ? { maxBatch: extras.maxBatch } : {}),
  };
}

function codeFromStatusConflict(status: string): string {
  if (status === "approved") {
    return "BOOKING_ALREADY_APPROVED";
  }
  if (status === "cancelled") {
    return "BOOKING_ALREADY_CANCELLED";
  }
  return "BOOKING_STATUS_CONFLICT";
}

/**
 * Resolve a Booking-owned error to HTTP. Returns null when the error is not a known Booking domain fault.
 */
export function resolveBookingHttpError(error: unknown): BookingHttpErrorResolution | null {
  if (error instanceof BookingWorkspaceTenantMismatchError) {
    return resolutionFromCode(error.code, error.message);
  }
  if (error instanceof BookingCapabilityViolationError) {
    return resolutionFromCode(error.code, error.message);
  }
  if (error instanceof BookingPublicCreateUnsupportedError) {
    return resolutionFromCode(error.code, error.message);
  }
  if (error instanceof BookingWorkspaceUnsupportedError) {
    return resolutionFromCode(error.code, error.message);
  }
  if (error instanceof BookingsOpsForbiddenError) {
    // OpenAPI / ops suite: code BOOKINGS_OPS_FORBIDDEN, error "forbidden"
    return resolutionFromCode("BOOKINGS_OPS_FORBIDDEN", error.message);
  }
  if (error instanceof BookingNotFoundError) {
    return resolutionFromCode(error.code, error.message);
  }
  if (error instanceof BulkApproveBatchLimitError) {
    return resolutionFromCode(error.code, error.message, { maxBatch: error.maxBatch });
  }
  if (error instanceof BookingStatusConflictError) {
    return resolutionFromCode(error.code, error.message);
  }

  if (!(error instanceof Error)) {
    return null;
  }
  const message = error.message;

  if (message.startsWith("BOOKING_CAPACITY_REJECTED")) {
    return resolutionFromCode("BOOKING_CAPACITY_REJECTED", message);
  }
  if (message === "BOOKING_GUEST_DUPLICATE" || message.startsWith("BOOKING_GUEST_DUPLICATE:")) {
    return resolutionFromCode("BOOKING_GUEST_DUPLICATE", message);
  }
  if (message.startsWith("BOOKING_VALIDATION_FAILED")) {
    return resolutionFromCode("BOOKING_VALIDATION_FAILED", message);
  }
  if (message.startsWith("BOOKING_VALIDATION_REJECTED")) {
    return resolutionFromCode("BOOKING_VALIDATION_REJECTED", message);
  }
  if (message.startsWith("BOOKING_WORKSPACE_TENANT_MISMATCH")) {
    return resolutionFromCode("BOOKING_WORKSPACE_TENANT_MISMATCH", message);
  }
  if (message.startsWith("BOOKING_CAPABILITY_VIOLATION")) {
    return resolutionFromCode("BOOKING_CAPABILITY_VIOLATION", message);
  }
  if (message.startsWith("BOOKING_PUBLIC_CREATE_UNSUPPORTED")) {
    return resolutionFromCode("BOOKING_PUBLIC_CREATE_UNSUPPORTED", message);
  }
  if (message.startsWith("BOOKING_WORKSPACE_UNSUPPORTED")) {
    return resolutionFromCode("BOOKING_WORKSPACE_UNSUPPORTED", message);
  }
  if (message === "BOOKING_NOT_FOUND" || message.startsWith("BOOKING_NOT_FOUND:")) {
    return resolutionFromCode("BOOKING_NOT_FOUND", message);
  }
  if (message === "BOOKING_FORBIDDEN" || message.startsWith("BOOKING_FORBIDDEN:")) {
    return resolutionFromCode("BOOKING_FORBIDDEN", message);
  }
  if (message === "BOOKINGS_OPS_FORBIDDEN" || message.startsWith("BOOKINGS_OPS_FORBIDDEN:")) {
    return resolutionFromCode("BOOKINGS_OPS_FORBIDDEN", message);
  }
  if (message === "BOOKINGS_FORBIDDEN") {
    // Receipt ownership denial on booking receipt routes.
    return resolutionFromCode("BOOKINGS_FORBIDDEN", message);
  }
  if (message.startsWith("BOOKING_ALREADY_APPROVED")) {
    return resolutionFromCode("BOOKING_ALREADY_APPROVED", message);
  }
  if (message.startsWith("BOOKING_ALREADY_CANCELLED")) {
    return resolutionFromCode("BOOKING_ALREADY_CANCELLED", message);
  }
  if (message.startsWith("BOOKING_STATUS_CONFLICT")) {
    const statusPart = message.split(":")[1]?.trim() ?? "";
    return resolutionFromCode(codeFromStatusConflict(statusPart), message);
  }
  if (message.startsWith("BULK_APPROVE_BATCH_LIMIT")) {
    const maxRaw = message.split(":")[1]?.trim();
    const maxBatch = maxRaw !== undefined ? Number.parseInt(maxRaw, 10) : undefined;
    return resolutionFromCode(
      "BULK_APPROVE_BATCH_LIMIT",
      message,
      Number.isFinite(maxBatch) ? { maxBatch } : undefined
    );
  }

  return null;
}

/** Codes that must never map to HTTP 500. */
export const BOOKING_KNOWN_ERROR_CODES: readonly string[] = BOOKING_HTTP_ERROR_MATRIX.map(
  (row) => row.domainError
);
