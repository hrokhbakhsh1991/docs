import {
  DRIVER_ATTENDANCE_STATUSES,
  type DriverAttendanceStatus,
} from "@app-tour/workspace-denali/execution";

import { listBookings } from "../bookings/create-bookings-service";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context";
import {
  getTourExecutionRepository,
} from "./tour-execution.repository.factory";
import type { TourExecutionSnapshot } from "./tour-execution.repository";
import { TourExecutionHttpError } from "./tour-execution.errors";

type UpdateTourExecutionDriverFactRequest = {
  readonly expectedVersion: unknown;
  readonly actualPassengerCount: unknown;
  readonly attendanceStatus: unknown;
  readonly reason?: unknown;
};

function executionError(code: string, statusCode: number, message: string): Error {
  return new TourExecutionHttpError(code, statusCode, message);
}

function assertNonNegativeInt(value: unknown, code: string): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw executionError(code, 422, "Expected a non-negative integer");
  }
}

function assertAttendanceStatus(value: unknown): asserts value is DriverAttendanceStatus {
  if (
    typeof value !== "string" ||
    !(DRIVER_ATTENDANCE_STATUSES as readonly string[]).includes(value)
  ) {
    throw executionError("ATTENDANCE_STATUS_INVALID", 422, "Attendance status is invalid");
  }
}

export async function getTourExecution(
  auth: BookingActorContext,
  tourId: string
): Promise<TourExecutionSnapshot | null> {
  return getTourExecutionRepository().get(auth.tenantId, tourId.trim());
}

export async function startTourExecution(
  auth: BookingActorContext,
  tourId: string
): Promise<{ readonly snapshot: TourExecutionSnapshot; readonly replay: boolean }> {
  const normalizedTourId = tourId.trim();
  const bookings = await listBookings(auth, {
    view: "ops",
    tourId: normalizedTourId,
    status: "approved",
    limit: 500,
    sort: "submittedAt",
  });
  const drivers = bookings.items
    .filter((row) => row.transportKind === "personal_car")
    .map((row) => ({
      registrationId: row.id,
      offeredPassengerCapacity: Math.max(0, Math.floor(row.personalCarOccupants ?? 0)),
    }));
  return getTourExecutionRepository().start({
    tenantId: auth.tenantId,
    tourId: normalizedTourId,
    actorUserId: auth.userId,
    drivers,
    nowIso: new Date().toISOString(),
  });
}

export async function updateTourExecutionDriverFact(
  auth: BookingActorContext,
  tourId: string,
  driverRegistrationId: string,
  input: UpdateTourExecutionDriverFactRequest
) {
  assertNonNegativeInt(input.expectedVersion, "EXECUTION_VERSION_INVALID");
  assertNonNegativeInt(input.actualPassengerCount, "ACTUAL_PASSENGER_COUNT_INVALID");
  assertAttendanceStatus(input.attendanceStatus);
  if (input.reason !== undefined && (typeof input.reason !== "string" || input.reason.length > 1000)) {
    throw executionError("EXECUTION_REASON_INVALID", 422, "Reason must be a short string");
  }
  const current = await getTourExecutionRepository().get(auth.tenantId, tourId.trim());
  if (current === null) {
    throw executionError("EXECUTION_NOT_STARTED", 409, "Tour execution has not started");
  }
  const fact = current.driverFacts.find(
    (item) => item.driverRegistrationId === driverRegistrationId.trim()
  );
  if (fact === undefined) {
    throw executionError("DRIVER_EXECUTION_FACT_NOT_FOUND", 404, "Driver execution fact not found");
  }
  if (input.actualPassengerCount > fact.offeredPassengerCapacity) {
    throw executionError(
      "ATTENDANCE_CAPACITY_EXCEEDED",
      422,
      "Actual passenger count exceeds offered capacity"
    );
  }
  if (input.attendanceStatus === "cancelled" && input.actualPassengerCount !== 0) {
    throw executionError(
      "CANCELLED_DRIVER_PASSENGER_COUNT_INVALID",
      422,
      "Cancelled driver must have zero actual passengers"
    );
  }
  const reason = input.reason?.trim();
  return getTourExecutionRepository().updateDriverFact({
    tenantId: auth.tenantId,
    executionId: current.execution.id,
    driverRegistrationId: driverRegistrationId.trim(),
    actorUserId: auth.userId,
    expectedVersion: input.expectedVersion,
    actualPassengerCount: input.actualPassengerCount,
    attendanceStatus: input.attendanceStatus,
    ...(reason !== undefined ? { reason } : {}),
    nowIso: new Date().toISOString(),
  });
}

export async function completeTourExecution(
  auth: BookingActorContext,
  tourId: string
) {
  return getTourExecutionRepository().complete(
    auth.tenantId,
    tourId.trim(),
    auth.userId,
    new Date().toISOString()
  );
}
