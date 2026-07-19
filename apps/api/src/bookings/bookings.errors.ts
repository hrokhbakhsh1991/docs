import type { BookingStatus } from "./bookings.types";

/** Application-owned booking domain errors (Phase B0.6). */

/** Tenant workspace is missing, empty, or not in workspaceBooking capability bindings. */
export class BookingWorkspaceUnsupportedError extends Error {
  readonly code = "BOOKING_WORKSPACE_UNSUPPORTED" as const;

  constructor(detail?: string) {
    super(
      detail !== undefined && detail.length > 0
        ? `BOOKING_WORKSPACE_UNSUPPORTED: ${detail}`
        : "BOOKING_WORKSPACE_UNSUPPORTED"
    );
    this.name = "BookingWorkspaceUnsupportedError";
  }
}

/**
 * BookingRuntime.workspaceType does not match the workspaceType owned by tenantId.
 * Invariant: tenantId → workspaceType (B2.0).
 */
export class BookingWorkspaceTenantMismatchError extends Error {
  readonly code = "BOOKING_WORKSPACE_TENANT_MISMATCH" as const;
  readonly tenantId: string;
  readonly runtimeWorkspaceType: string;
  readonly tenantWorkspaceType: string;

  constructor(input: {
    readonly tenantId: string;
    readonly runtimeWorkspaceType: string;
    readonly tenantWorkspaceType: string;
  }) {
    super(
      `BOOKING_WORKSPACE_TENANT_MISMATCH: tenantId=${input.tenantId} runtime=${input.runtimeWorkspaceType} owned=${input.tenantWorkspaceType}`
    );
    this.name = "BookingWorkspaceTenantMismatchError";
    this.tenantId = input.tenantId;
    this.runtimeWorkspaceType = input.runtimeWorkspaceType;
    this.tenantWorkspaceType = input.tenantWorkspaceType;
  }
}

/** Workspace publicBooking.supportsPublicCreate() is false for this runtime. */
export class BookingPublicCreateUnsupportedError extends Error {
  readonly code = "BOOKING_PUBLIC_CREATE_UNSUPPORTED" as const;

  constructor(detail?: string) {
    super(
      detail !== undefined && detail.length > 0
        ? `BOOKING_PUBLIC_CREATE_UNSUPPORTED: ${detail}`
        : "BOOKING_PUBLIC_CREATE_UNSUPPORTED"
    );
    this.name = "BookingPublicCreateUnsupportedError";
  }
}

/**
 * Graded capability claim does not match runtime adapters / bindings (fail-closed).
 * Used when `supported=true` but levels are missing, hollow, or downgraded vs implementation.
 */
export class BookingCapabilityViolationError extends Error {
  readonly code = "BOOKING_CAPABILITY_VIOLATION" as const;
  readonly workspaceType: string;
  readonly capability: string;

  constructor(input: {
    readonly workspaceType: string;
    readonly capability: string;
    readonly detail: string;
  }) {
    super(
      `BOOKING_CAPABILITY_VIOLATION: workspaceType=${input.workspaceType} capability=${input.capability} ${input.detail}`
    );
    this.name = "BookingCapabilityViolationError";
    this.workspaceType = input.workspaceType;
    this.capability = input.capability;
  }
}

export class BookingsOpsForbiddenError extends Error {
  readonly code = "BOOKINGS_OPS_FORBIDDEN" as const;

  constructor() {
    super("BOOKINGS_OPS_FORBIDDEN");
    this.name = "BookingsOpsForbiddenError";
  }
}

export class BookingNotFoundError extends Error {
  readonly code = "BOOKING_NOT_FOUND" as const;

  constructor() {
    super("BOOKING_NOT_FOUND");
    this.name = "BookingNotFoundError";
  }
}

export class BulkApproveBatchLimitError extends Error {
  readonly code = "BULK_APPROVE_BATCH_LIMIT" as const;

  constructor(readonly maxBatch: number) {
    super(`BULK_APPROVE_BATCH_LIMIT:${maxBatch}`);
    this.name = "BulkApproveBatchLimitError";
  }
}

export type BookingStatusConflictCode =
  | "BOOKING_ALREADY_APPROVED"
  | "BOOKING_ALREADY_CANCELLED"
  | "BOOKING_STATUS_CONFLICT";

export class BookingStatusConflictError extends Error {
  readonly code: BookingStatusConflictCode;

  constructor(readonly status: BookingStatus) {
    const code: BookingStatusConflictCode =
      status === "approved"
        ? "BOOKING_ALREADY_APPROVED"
        : status === "cancelled"
          ? "BOOKING_ALREADY_CANCELLED"
          : "BOOKING_STATUS_CONFLICT";
    super(`${code}:${status}`);
    this.name = "BookingStatusConflictError";
    this.code = code;
  }
}
