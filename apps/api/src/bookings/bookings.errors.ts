import type { BookingStatus } from "./bookings.types";

/** Application-owned booking domain errors (Phase B0.6). */

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

export class BookingStatusConflictError extends Error {
  readonly code = "BOOKING_STATUS_CONFLICT" as const;

  constructor(readonly status: BookingStatus) {
    super(`BOOKING_STATUS_CONFLICT:${status}`);
    this.name = "BookingStatusConflictError";
  }
}
