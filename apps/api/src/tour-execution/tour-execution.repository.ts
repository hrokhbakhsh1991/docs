import { randomUUID } from "node:crypto";

import type {
  DriverExecutionFact,
  DriverExecutionFactAudit,
  TourExecution,
  UpdateDriverExecutionFactInput,
} from "@app-tour/workspace-denali/execution";
import { TourExecutionHttpError } from "./tour-execution.errors";

export type TourExecutionSnapshot = {
  readonly execution: TourExecution;
  readonly driverFacts: readonly DriverExecutionFact[];
};

export type StartTourExecutionInput = {
  readonly tenantId: string;
  readonly tourId: string;
  readonly actorUserId: string;
  readonly drivers: readonly {
    readonly registrationId: string;
    readonly offeredPassengerCapacity: number;
  }[];
  readonly nowIso: string;
};

export type UpdateDriverFactCommand = UpdateDriverExecutionFactInput & {
  readonly tenantId: string;
  readonly executionId: string;
  readonly driverRegistrationId: string;
  readonly actorUserId: string;
  readonly nowIso: string;
};

export interface TourExecutionRepository {
  get(tenantId: string, tourId: string): Promise<TourExecutionSnapshot | null>;
  start(input: StartTourExecutionInput): Promise<{ readonly snapshot: TourExecutionSnapshot; readonly replay: boolean }>;
  updateDriverFact(command: UpdateDriverFactCommand): Promise<DriverExecutionFact>;
  complete(
    tenantId: string,
    tourId: string,
    actorUserId: string,
    nowIso: string
  ): Promise<{ readonly execution: TourExecution; readonly replay: boolean }>;
}

type MemoryStore = {
  executions: Map<string, TourExecution>;
  facts: Map<string, DriverExecutionFact>;
  audits: Map<string, DriverExecutionFactAudit[]>;
};

const store: MemoryStore = {
  executions: new Map(),
  facts: new Map(),
  audits: new Map(),
};

function executionKey(tenantId: string, tourId: string): string {
  return `${tenantId}:${tourId}`;
}

function factKey(tenantId: string, executionId: string, registrationId: string): string {
  return `${tenantId}:${executionId}:${registrationId}`;
}

function listFacts(tenantId: string, executionId: string): readonly DriverExecutionFact[] {
  return [...store.facts.values()]
    .filter((fact) => fact.tenantId === tenantId && fact.executionId === executionId)
    .sort((left, right) => left.driverRegistrationId.localeCompare(right.driverRegistrationId));
}

function executionError(code: string, statusCode: number, message: string): Error {
  return new TourExecutionHttpError(code, statusCode, message);
}

export class InMemoryTourExecutionRepository implements TourExecutionRepository {
  async get(tenantId: string, tourId: string): Promise<TourExecutionSnapshot | null> {
    const execution = store.executions.get(executionKey(tenantId, tourId)) ?? null;
    return execution === null ? null : { execution, driverFacts: listFacts(tenantId, execution.id) };
  }

  async start(input: StartTourExecutionInput): Promise<{ readonly snapshot: TourExecutionSnapshot; readonly replay: boolean }> {
    const existing = await this.get(input.tenantId, input.tourId);
    if (existing !== null) {
      return { snapshot: existing, replay: true };
    }
    const execution: TourExecution = {
      id: randomUUID(),
      tenantId: input.tenantId,
      tourId: input.tourId,
      status: "in_progress",
      startedAt: input.nowIso,
      completedAt: null,
      cancelledAt: null,
      createdByUserId: input.actorUserId,
      completedByUserId: null,
      version: 1,
      createdAt: input.nowIso,
      updatedAt: input.nowIso,
    };
    store.executions.set(executionKey(input.tenantId, input.tourId), execution);
    for (const driver of input.drivers) {
      const fact: DriverExecutionFact = {
        id: randomUUID(),
        tenantId: input.tenantId,
        executionId: execution.id,
        driverRegistrationId: driver.registrationId,
        offeredPassengerCapacity: driver.offeredPassengerCapacity,
        actualPassengerCount: 0,
        attendanceStatus: "not_arrived",
        version: 1,
        lastEditedByUserId: input.actorUserId,
        lastEditedAt: input.nowIso,
        createdAt: input.nowIso,
        updatedAt: input.nowIso,
      };
      store.facts.set(factKey(input.tenantId, execution.id, driver.registrationId), fact);
      store.audits.set(fact.id, []);
    }
    return {
      snapshot: { execution, driverFacts: listFacts(input.tenantId, execution.id) },
      replay: false,
    };
  }

  async updateDriverFact(command: UpdateDriverFactCommand): Promise<DriverExecutionFact> {
    const execution = [...store.executions.values()].find(
      (item) => item.id === command.executionId && item.tenantId === command.tenantId
    );
    if (execution === undefined) {
      throw executionError("EXECUTION_NOT_STARTED", 409, "Tour execution has not started");
    }
    if (execution.status !== "in_progress") {
      throw executionError("TOUR_EXECUTION_NOT_EDITABLE", 409, "Tour execution is not editable");
    }
    const key = factKey(command.tenantId, command.executionId, command.driverRegistrationId);
    const current = store.facts.get(key);
    if (current === undefined) {
      throw executionError("DRIVER_EXECUTION_FACT_NOT_FOUND", 404, "Driver execution fact not found");
    }
    if (current.version !== command.expectedVersion) {
      throw executionError("STALE_EXECUTION_VERSION", 409, "Driver execution fact has changed");
    }
    const updated: DriverExecutionFact = {
      ...current,
      actualPassengerCount: command.actualPassengerCount,
      attendanceStatus: command.attendanceStatus,
      version: current.version + 1,
      lastEditedByUserId: command.actorUserId,
      lastEditedAt: command.nowIso,
      updatedAt: command.nowIso,
    };
    const audit: DriverExecutionFactAudit = {
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
      createdAt: command.nowIso,
    };
    store.facts.set(key, updated);
    store.audits.set(current.id, [...(store.audits.get(current.id) ?? []), audit]);
    return updated;
  }

  async complete(
    tenantId: string,
    tourId: string,
    actorUserId: string,
    nowIso: string
  ): Promise<{ readonly execution: TourExecution; readonly replay: boolean }> {
    const existing = await this.get(tenantId, tourId);
    if (existing === null) {
      throw executionError("EXECUTION_NOT_STARTED", 409, "Tour execution has not started");
    }
    if (existing.execution.status === "completed") {
      return { execution: existing.execution, replay: true };
    }
    if (existing.execution.status !== "in_progress") {
      throw executionError("TOUR_EXECUTION_TRANSITION_INVALID", 409, "Tour execution cannot be completed");
    }
    const execution: TourExecution = {
      ...existing.execution,
      status: "completed",
      completedAt: nowIso,
      completedByUserId: actorUserId,
      version: existing.execution.version + 1,
      updatedAt: nowIso,
    };
    store.executions.set(executionKey(tenantId, tourId), execution);
    return { execution, replay: false };
  }
}

export function resetInMemoryTourExecutionRepositoryForTests(): void {
  store.executions.clear();
  store.facts.clear();
  store.audits.clear();
}
