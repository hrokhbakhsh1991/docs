import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";
import type {
  DriverExecutionFact,
  TourExecution,
} from "@app-tour/workspace-denali/execution";

import { withTenantRls } from "../../db/with-tenant-rls";
import {
  type StartTourExecutionInput,
  type TourExecutionRepository,
  type TourExecutionSnapshot,
  type UpdateDriverFactCommand,
} from "../../tour-execution/tour-execution.repository";
import { TourExecutionHttpError } from "../../tour-execution/tour-execution.errors";

function executionError(code: string, statusCode: number, message: string): Error {
  return new TourExecutionHttpError(code, statusCode, message);
}

function mapExecution(row: {
  id: string;
  tenantId: string;
  tourId: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdByUserId: string;
  completedByUserId: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}): TourExecution {
  return {
    id: row.id,
    tenantId: row.tenantId,
    tourId: row.tourId,
    status: row.status as TourExecution["status"],
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    createdByUserId: row.createdByUserId,
    completedByUserId: row.completedByUserId,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function mapFact(row: {
  id: string;
  tenantId: string;
  executionId: string;
  driverRegistrationId: string;
  offeredPassengerCapacity: number;
  actualPassengerCount: number;
  attendanceStatus: string;
  version: number;
  lastEditedByUserId: string;
  lastEditedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}): DriverExecutionFact {
  return {
    id: row.id,
    tenantId: row.tenantId,
    executionId: row.executionId,
    driverRegistrationId: row.driverRegistrationId,
    offeredPassengerCapacity: row.offeredPassengerCapacity,
    actualPassengerCount: row.actualPassengerCount,
    attendanceStatus: row.attendanceStatus as DriverExecutionFact["attendanceStatus"],
    version: row.version,
    lastEditedByUserId: row.lastEditedByUserId,
    lastEditedAt: row.lastEditedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function snapshot(
  tx: Prisma.TransactionClient,
  tenantId: string,
  tourId: string
): Promise<TourExecutionSnapshot | null> {
  const execution = await tx.tourExecution.findUnique({
    where: { tenantId_tourId: { tenantId, tourId } },
    include: { driverFacts: { orderBy: { driverRegistrationId: "asc" } } },
  });
  return execution === null
    ? null
    : { execution: mapExecution(execution), driverFacts: execution.driverFacts.map(mapFact) };
}

function isPrismaUniqueError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export class PrismaTourExecutionRepository implements TourExecutionRepository {
  async get(tenantId: string, tourId: string): Promise<TourExecutionSnapshot | null> {
    return withTenantRls(tenantId, (tx) => snapshot(tx, tenantId, tourId));
  }

  async start(input: StartTourExecutionInput): Promise<{ readonly snapshot: TourExecutionSnapshot; readonly replay: boolean }> {
    return withTenantRls(input.tenantId, async (tx) => {
      const existing = await snapshot(tx, input.tenantId, input.tourId);
      if (existing !== null) {
        return { snapshot: existing, replay: true };
      }
      try {
        const execution = await tx.tourExecution.create({
          data: {
            id: randomUUID(),
            tenantId: input.tenantId,
            tourId: input.tourId,
            status: "in_progress",
            startedAt: new Date(input.nowIso),
            createdByUserId: input.actorUserId,
            version: 1,
            createdAt: new Date(input.nowIso),
            updatedAt: new Date(input.nowIso),
            driverFacts: {
              create: input.drivers.map((driver) => ({
                id: randomUUID(),
                tenantId: input.tenantId,
                driverRegistrationId: driver.registrationId,
                offeredPassengerCapacity: driver.offeredPassengerCapacity,
                actualPassengerCount: 0,
                attendanceStatus: "not_arrived",
                version: 1,
                lastEditedByUserId: input.actorUserId,
                lastEditedAt: new Date(input.nowIso),
                createdAt: new Date(input.nowIso),
                updatedAt: new Date(input.nowIso),
              })),
            },
          },
        });
        const created = await snapshot(tx, input.tenantId, execution.tourId);
        if (created === null) {
          throw new Error("TOUR_EXECUTION_CREATE_READBACK_FAILED");
        }
        return { snapshot: created, replay: false };
      } catch (error) {
        if (!isPrismaUniqueError(error)) {
          throw error;
        }
        const replay = await snapshot(tx, input.tenantId, input.tourId);
        if (replay === null) {
          throw error;
        }
        return { snapshot: replay, replay: true };
      }
    });
  }

  async updateDriverFact(command: UpdateDriverFactCommand): Promise<DriverExecutionFact> {
    return withTenantRls(command.tenantId, async (tx) => {
      const execution = await tx.tourExecution.findFirst({
        where: { id: command.executionId, tenantId: command.tenantId },
      });
      if (execution === null) {
        throw executionError("EXECUTION_NOT_STARTED", 409, "Tour execution has not started");
      }
      if (execution.status !== "in_progress") {
        throw executionError("TOUR_EXECUTION_NOT_EDITABLE", 409, "Tour execution is not editable");
      }
      const current = await tx.driverExecutionFact.findUnique({
        where: {
          tenantId_executionId_driverRegistrationId: {
            tenantId: command.tenantId,
            executionId: command.executionId,
            driverRegistrationId: command.driverRegistrationId,
          },
        },
      });
      if (current === null) {
        throw executionError("DRIVER_EXECUTION_FACT_NOT_FOUND", 404, "Driver execution fact not found");
      }
      if (current.version !== command.expectedVersion) {
        throw executionError("STALE_EXECUTION_VERSION", 409, "Driver execution fact has changed");
      }
      const mutation = await tx.driverExecutionFact.updateMany({
        where: {
          id: current.id,
          tenantId: command.tenantId,
          version: command.expectedVersion,
        },
        data: {
          actualPassengerCount: command.actualPassengerCount,
          attendanceStatus: command.attendanceStatus,
          version: { increment: 1 },
          lastEditedByUserId: command.actorUserId,
          lastEditedAt: new Date(command.nowIso),
          updatedAt: new Date(command.nowIso),
        },
      });
      if (mutation.count !== 1) {
        throw executionError("STALE_EXECUTION_VERSION", 409, "Driver execution fact has changed");
      }
      const updated = await tx.driverExecutionFact.findUnique({ where: { id: current.id } });
      if (updated === null) {
        throw new Error("TOUR_EXECUTION_FACT_UPDATE_READBACK_FAILED");
      }
      await tx.driverExecutionFactAudit.create({
        data: {
          id: randomUUID(),
          tenantId: command.tenantId,
          factId: current.id,
          sequence: current.version,
          previousActualPassengerCount: current.actualPassengerCount,
          nextActualPassengerCount: updated.actualPassengerCount,
          previousAttendanceStatus: current.attendanceStatus,
          nextAttendanceStatus: updated.attendanceStatus,
          reason: command.reason?.trim() || null,
          actorUserId: command.actorUserId,
          createdAt: new Date(command.nowIso),
        },
      });
      return mapFact(updated);
    });
  }

  async complete(
    tenantId: string,
    tourId: string,
    actorUserId: string,
    nowIso: string
  ): Promise<{ readonly execution: TourExecution; readonly replay: boolean }> {
    return withTenantRls(tenantId, async (tx) => {
      const current = await tx.tourExecution.findUnique({
        where: { tenantId_tourId: { tenantId, tourId } },
      });
      if (current === null) {
        throw executionError("EXECUTION_NOT_STARTED", 409, "Tour execution has not started");
      }
      if (current.status === "completed") {
        return { execution: mapExecution(current), replay: true };
      }
      if (current.status !== "in_progress") {
        throw executionError("TOUR_EXECUTION_TRANSITION_INVALID", 409, "Tour execution cannot be completed");
      }
      const mutation = await tx.tourExecution.updateMany({
        where: { id: current.id, tenantId, version: current.version, status: "in_progress" },
        data: {
          status: "completed",
          completedAt: new Date(nowIso),
          completedByUserId: actorUserId,
          version: { increment: 1 },
          updatedAt: new Date(nowIso),
        },
      });
      if (mutation.count !== 1) {
        const latest = await tx.tourExecution.findUnique({
          where: { tenantId_tourId: { tenantId, tourId } },
        });
        if (latest?.status === "completed") {
          return { execution: mapExecution(latest), replay: true };
        }
        throw executionError("TOUR_EXECUTION_TRANSITION_INVALID", 409, "Tour execution cannot be completed");
      }
      const updated = await tx.tourExecution.findUnique({ where: { id: current.id } });
      if (updated === null) {
        throw new Error("TOUR_EXECUTION_COMPLETE_READBACK_FAILED");
      }
      return { execution: mapExecution(updated), replay: false };
    });
  }
}
