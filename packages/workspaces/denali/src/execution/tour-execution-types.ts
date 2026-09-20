export const TOUR_EXECUTION_STATUSES = [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export type TourExecutionStatus = (typeof TOUR_EXECUTION_STATUSES)[number];

export const DRIVER_ATTENDANCE_STATUSES = [
  "not_arrived",
  "present",
  "departed",
  "cancelled",
] as const;

export type DriverAttendanceStatus = (typeof DRIVER_ATTENDANCE_STATUSES)[number];

export type TourExecution = {
  readonly id: string;
  readonly tenantId: string;
  readonly tourId: string;
  readonly status: TourExecutionStatus;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly createdByUserId: string;
  readonly completedByUserId: string | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DriverExecutionFact = {
  readonly id: string;
  readonly tenantId: string;
  readonly executionId: string;
  readonly driverRegistrationId: string;
  readonly offeredPassengerCapacity: number;
  readonly actualPassengerCount: number;
  readonly attendanceStatus: DriverAttendanceStatus;
  readonly version: number;
  readonly lastEditedByUserId: string;
  readonly lastEditedAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type DriverExecutionFactAudit = {
  readonly id: string;
  readonly tenantId: string;
  readonly factId: string;
  readonly sequence: number;
  readonly previousActualPassengerCount: number;
  readonly nextActualPassengerCount: number;
  readonly previousAttendanceStatus: DriverAttendanceStatus;
  readonly nextAttendanceStatus: DriverAttendanceStatus;
  readonly reason: string | null;
  readonly actorUserId: string;
  readonly createdAt: string;
};

export type UpdateDriverExecutionFactInput = {
  readonly expectedVersion: number;
  readonly actualPassengerCount: number;
  readonly attendanceStatus: DriverAttendanceStatus;
  readonly reason?: string;
};
