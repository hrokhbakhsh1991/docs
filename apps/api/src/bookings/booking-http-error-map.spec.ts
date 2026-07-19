/**
 * Booking HTTP error matrix — every known domain error maps; never HTTP 500.
 *
 * @see docs/phase-20/p7/appendices/BOOKING_HTTP_ERROR_MATRIX.md
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  BOOKING_HTTP_ERROR_MATRIX,
  BOOKING_KNOWN_ERROR_CODES,
  resolveBookingHttpError,
} from "./booking-http-error-map.ts";
import {
  BookingCapabilityViolationError,
  BookingNotFoundError,
  BookingPublicCreateUnsupportedError,
  BookingsOpsForbiddenError,
  BookingStatusConflictError,
  BookingWorkspaceTenantMismatchError,
  BookingWorkspaceUnsupportedError,
  BulkApproveBatchLimitError,
} from "./bookings.errors.ts";

describe("booking HTTP error map", () => {
  it("matrix covers required domain errors", () => {
    const required = [
      "BOOKING_WORKSPACE_TENANT_MISMATCH",
      "BOOKING_CAPABILITY_VIOLATION",
      "BOOKING_PUBLIC_CREATE_UNSUPPORTED",
      "BOOKING_CAPACITY_REJECTED",
      "BOOKING_ALREADY_APPROVED",
      "BOOKING_ALREADY_CANCELLED",
      "BOOKING_NOT_FOUND",
      "BOOKING_FORBIDDEN",
      "BOOKING_VALIDATION_FAILED",
      "BOOKING_WORKSPACE_UNSUPPORTED",
      "BOOKING_STATUS_CONFLICT",
      "BULK_APPROVE_BATCH_LIMIT",
    ];
    for (const code of required) {
      assert.ok(
        BOOKING_KNOWN_ERROR_CODES.includes(code),
        `matrix missing ${code}`
      );
    }
  });

  it("every matrix row resolves to its HTTP status (never 500)", () => {
    for (const row of BOOKING_HTTP_ERROR_MATRIX) {
      assert.notEqual(row.status, 500, `${row.domainError} must not be 500`);
      const resolved = resolveBookingHttpError(new Error(`${row.domainError}: probe`));
      assert.ok(resolved, `unresolved ${row.domainError}`);
      assert.equal(resolved.status, row.status, row.domainError);
      assert.equal(resolved.code, row.domainError);
      assert.equal(resolved.clientAction, row.clientAction);
    }
  });

  it("typed Booking errors map correctly", () => {
    const cases: readonly { error: Error; status: number; code: string }[] = [
      {
        error: new BookingWorkspaceTenantMismatchError({
          tenantId: "t",
          runtimeWorkspaceType: "denali",
          tenantWorkspaceType: "booking-ws2",
        }),
        status: 403,
        code: "BOOKING_WORKSPACE_TENANT_MISMATCH",
      },
      {
        error: new BookingCapabilityViolationError({
          workspaceType: "denali",
          capability: "publicCreate",
          detail: "hollow",
        }),
        status: 422,
        code: "BOOKING_CAPABILITY_VIOLATION",
      },
      {
        error: new BookingPublicCreateUnsupportedError("off"),
        status: 403,
        code: "BOOKING_PUBLIC_CREATE_UNSUPPORTED",
      },
      {
        error: new BookingStatusConflictError("approved"),
        status: 409,
        code: "BOOKING_ALREADY_APPROVED",
      },
      {
        error: new BookingStatusConflictError("cancelled"),
        status: 409,
        code: "BOOKING_ALREADY_CANCELLED",
      },
      {
        error: new BookingStatusConflictError("rejected"),
        status: 409,
        code: "BOOKING_STATUS_CONFLICT",
      },
      {
        error: new BookingNotFoundError(),
        status: 404,
        code: "BOOKING_NOT_FOUND",
      },
      {
        error: new BookingsOpsForbiddenError(),
        status: 403,
        code: "BOOKINGS_OPS_FORBIDDEN",
      },
      {
        error: new BookingWorkspaceUnsupportedError("urban"),
        status: 404,
        code: "BOOKING_WORKSPACE_UNSUPPORTED",
      },
      {
        error: new BulkApproveBatchLimitError(25),
        status: 400,
        code: "BULK_APPROVE_BATCH_LIMIT",
      },
    ];

    for (const c of cases) {
      const resolved = resolveBookingHttpError(c.error);
      assert.ok(resolved, c.error.name);
      assert.equal(resolved.status, c.status, c.error.name);
      assert.equal(resolved.code, c.code, c.error.name);
      assert.notEqual(resolved.status, 500);
    }
  });

  it("string adapter errors map (capacity + validation)", () => {
    const capacity = resolveBookingHttpError(
      new Error("BOOKING_CAPACITY_REJECTED: occupied=10 partySize=1 capacityMax=10")
    );
    assert.equal(capacity?.status, 409);
    assert.equal(capacity?.code, "BOOKING_CAPACITY_REJECTED");

    const validationFailed = resolveBookingHttpError(
      new Error("BOOKING_VALIDATION_FAILED: guestLabel required")
    );
    assert.equal(validationFailed?.status, 400);
    assert.equal(validationFailed?.code, "BOOKING_VALIDATION_FAILED");

    const validationRejected = resolveBookingHttpError(
      new Error("BOOKING_VALIDATION_REJECTED: partySize must be >= 1")
    );
    assert.equal(validationRejected?.status, 400);
    assert.equal(validationRejected?.code, "BOOKING_VALIDATION_REJECTED");
  });

  it("unknown non-Booking errors are not claimed (may 500 elsewhere)", () => {
    assert.equal(resolveBookingHttpError(new Error("SOME_RANDOM_INTERNAL")), null);
    assert.equal(resolveBookingHttpError(new Error("ECONNRESET")), null);
  });

  it("no known Booking code falls through to 500", () => {
    for (const code of BOOKING_KNOWN_ERROR_CODES) {
      const resolved = resolveBookingHttpError(new Error(`${code}: no-500`));
      assert.ok(resolved, `known code unresolved: ${code}`);
      assert.notEqual(resolved.status, 500, `default 500 leak: ${code}`);
    }
  });

  it("prints matrix for audit report", () => {
    console.log("Domain Error | HTTP Status | Reason | Client Action");
    for (const row of BOOKING_HTTP_ERROR_MATRIX) {
      console.log(
        `${row.domainError} | ${row.status} | ${row.reason} | ${row.clientAction}`
      );
    }
  });
});
