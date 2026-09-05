import { randomUUID } from "node:crypto";

import type { Prisma } from "@prisma/client";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { getPrismaAdmin } from "../db/prisma";
import { withTenantRls } from "../db/with-tenant-rls";
import { appendAuditEvent } from "../audit/audit-logger";
import {
  assertTourExecutionAdmin,
  assertTourExecutionMutate,
  assertTourExecutionRead,
  TourExecutionForbiddenError,
  TourExecutionInvalidStateError,
  TourExecutionInvalidTransitionError,
  TourExecutionNotFoundError,
  TourExecutionVersionConflictError,
} from "./tour-execution-authorization";
import {
  DEFAULT_CHECKLIST_TEMPLATES,
  TOUR_EXECUTION_STATE_TRANSITIONS,
  type MemberTourExecutionSummaryView,
  type TourExecutionChangeKind,
  type TourExecutionChecklistPhase,
  type TourExecutionState,
  type TourExecutionView,
} from "./tour-execution.types";

function deriveInsuranceStatus(intake: unknown): string | null {
  if (intake === null || typeof intake !== "object" || Array.isArray(intake)) {
    return null;
  }
  const record = intake as Readonly<Record<string, unknown>>;
  for (const key of ["insuranceStatus", "insuranceProvided", "insuranceConfirmed"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === "boolean") {
      return value ? "confirmed" : "missing";
    }
  }
  return null;
}

function toIso(value: Date | null | undefined): string | null {
  return value instanceof Date ? value.toISOString() : null;
}

async function loadExecutionView(
  tenantId: string,
  executionId: string,
): Promise<TourExecutionView | null> {
  return withTenantRls(tenantId, async (tx) => {
    const execution = await tx.tourExecution.findFirst({
      where: { id: executionId, tenantId },
    });
    if (execution === null) {
      return null;
    }

    const manifestRows = await tx.tourExecutionManifestRow.findMany({
      where: { tenantId, executionId },
      orderBy: [{ sortOrder: "asc" }, { guestLabel: "asc" }],
    });
    const registrationIds = manifestRows.map((row) => row.registrationId);
    const registrations =
      registrationIds.length > 0
        ? await tx.operatorRegistration.findMany({
            where: { tenantId, id: { in: registrationIds } },
            select: { id: true, attendanceStatus: true },
          })
        : [];
    const attendanceByRegistration = new Map(
      registrations.map((row) => [row.id, row.attendanceStatus]),
    );

    const groups = await tx.tourExecutionGroup.findMany({
      where: { tenantId, executionId },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    const checklist = await tx.tourExecutionChecklistItem.findMany({
      where: { tenantId, executionId },
      orderBy: [{ phase: "asc" }, { sortOrder: "asc" }],
    });
    const operationalEvents = await tx.tourExecutionOperationalEvent.findMany({
      where: { tenantId, executionId },
      orderBy: { reportedAt: "desc" },
      take: 50,
    });

    return {
      id: execution.id,
      tourId: execution.tourId,
      state: execution.state as TourExecutionState,
      rowVersion: execution.rowVersion,
      tourLeaderUserId: execution.tourLeaderUserId,
      scheduledMeetingAt: toIso(execution.scheduledMeetingAt),
      meetingLocation: execution.meetingLocation,
      manifestLockedAt: toIso(execution.manifestLockedAt),
      startedAt: toIso(execution.startedAt),
      completedAt: toIso(execution.completedAt),
      cancelledAt: toIso(execution.cancelledAt),
      manifest: manifestRows.map((row) => ({
        id: row.id,
        registrationId: row.registrationId,
        guestLabel: row.guestLabel,
        partySize: row.partySize,
        registrationStatus: row.registrationStatus,
        paymentStatus: row.paymentStatus,
        insuranceStatus: row.insuranceStatus,
        attendanceStatus: attendanceByRegistration.get(row.registrationId) ?? null,
        groupId: row.groupId,
        sortOrder: row.sortOrder,
      })),
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        leaderUserId: group.leaderUserId,
        sortOrder: group.sortOrder,
      })),
      checklist: checklist.map((item) => ({
        id: item.id,
        phase: item.phase as TourExecutionChecklistPhase,
        label: item.label,
        completedAt: toIso(item.completedAt),
        completedByUserId: item.completedByUserId,
        sortOrder: item.sortOrder,
      })),
      operationalEvents: operationalEvents.map((event) => ({
        id: event.id,
        eventKind: event.eventKind,
        severity: event.severity,
        description: event.description,
        reportedByUserId: event.reportedByUserId,
        reportedAt: event.reportedAt.toISOString(),
        resolvedAt: toIso(event.resolvedAt),
      })),
    };
  });
}

async function findActiveExecution(tenantId: string, tourId: string) {
  return withTenantRls(tenantId, async (tx) =>
    tx.tourExecution.findFirst({
      where: {
        tenantId,
        tourId,
        state: { notIn: ["completed", "cancelled"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

async function seedDefaultChecklist(
  tx: Prisma.TransactionClient,
  tenantId: string,
  executionId: string,
): Promise<void> {
  const existing = await tx.tourExecutionChecklistItem.count({
    where: { tenantId, executionId },
  });
  if (existing > 0) {
    return;
  }
  let sort = 0;
  for (const phase of ["pre", "during", "post"] as const) {
    for (const label of DEFAULT_CHECKLIST_TEMPLATES[phase]) {
      await tx.tourExecutionChecklistItem.create({
        data: {
          tenantId,
          executionId,
          phase,
          label,
          sortOrder: sort++,
        },
      });
    }
  }
}

export async function getOrBootstrapTourExecution(
  auth: TenantAuthContext,
  tourId: string,
): Promise<TourExecutionView> {
  assertTourExecutionRead(auth);
  const tenantId = auth.tenantId;

  let execution = await findActiveExecution(tenantId, tourId);
  if (execution === null) {
    execution = await withTenantRls(tenantId, async (tx) => {
      const tour = await tx.tour.findFirst({ where: { id: tourId, tenantId } });
      if (tour === null) {
        throw new TourExecutionNotFoundError();
      }
      const created = await tx.tourExecution.create({
        data: {
          tenantId,
          tourId,
          state: "draft",
          ...(tour.startDate !== null ? { scheduledMeetingAt: tour.startDate } : {}),
        },
      });
      await seedDefaultChecklist(tx, tenantId, created.id);
      return created;
    });
  }

  const view = await loadExecutionView(tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function lockTourExecutionManifest(
  auth: TenantAuthContext,
  tourId: string,
): Promise<TourExecutionView> {
  assertTourExecutionAdmin(auth);
  const tenantId = auth.tenantId;
  const execution = await findActiveExecution(tenantId, tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  if (execution.state !== "draft" && execution.manifestLockedAt !== null) {
    const view = await loadExecutionView(tenantId, execution.id);
    if (view === null) {
      throw new TourExecutionNotFoundError();
    }
    return view;
  }

  await withTenantRls(tenantId, async (tx) => {
    const approved = await tx.operatorRegistration.findMany({
      where: { tenantId, tourId, status: "approved" },
      orderBy: [{ submittedAt: "asc" }],
    });

    await tx.tourExecutionManifestRow.deleteMany({
      where: { tenantId, executionId: execution.id },
    });

    let sort = 0;
    for (const row of approved) {
      await tx.tourExecutionManifestRow.create({
        data: {
          tenantId,
          executionId: execution.id,
          registrationId: row.id,
          guestLabel: row.guestLabel,
          partySize: row.partySize,
          registrationStatus: row.status,
          paymentStatus: row.paymentStatus,
          insuranceStatus: deriveInsuranceStatus(row.registrationIntake),
          sortOrder: sort++,
        },
      });
    }

    await tx.tourExecution.updateMany({
      where: { id: execution.id, tenantId, rowVersion: execution.rowVersion },
      data: {
        state: "manifest_locked",
        manifestLockedAt: new Date(),
        rowVersion: { increment: 1 },
      },
    });

    await appendAuditEvent(tx, {
      action: "TOUR_EXECUTION_MANIFEST_LOCKED",
      entityType: "tour_execution",
      entityId: execution.id,
      metadata: { tourId, participantCount: approved.length },
    });
  });

  const updated = await findActiveExecution(tenantId, tourId);
  if (updated === null) {
    throw new TourExecutionNotFoundError();
  }
  const view = await loadExecutionView(tenantId, updated.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function transitionTourExecutionState(input: {
  auth: TenantAuthContext;
  tourId: string;
  targetState: TourExecutionState;
  expectedVersion: number;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  assertTourExecutionMutate(input.auth, execution);

  const current = execution.state as TourExecutionState;
  const allowed = TOUR_EXECUTION_STATE_TRANSITIONS[current] ?? [];
  if (current === input.targetState) {
    const view = await loadExecutionView(input.auth.tenantId, execution.id);
    if (view === null) {
      throw new TourExecutionNotFoundError();
    }
    return view;
  }
  if (!allowed.includes(input.targetState)) {
    throw new TourExecutionInvalidTransitionError(current, input.targetState);
  }

  const now = new Date();
  const data: Prisma.TourExecutionUpdateManyMutationInput = {
    state: input.targetState,
    rowVersion: { increment: 1 },
  };
  if (input.targetState === "in_progress") {
    data.startedAt = now;
  }
  if (input.targetState === "completed") {
    data.completedAt = now;
  }
  if (input.targetState === "cancelled") {
    data.cancelledAt = now;
  }

  await withTenantRls(input.auth.tenantId, async (tx) => {
    const updated = await tx.tourExecution.updateMany({
      where: {
        id: execution.id,
        tenantId: input.auth.tenantId,
        rowVersion: input.expectedVersion,
      },
      data,
    });
    if (updated.count !== 1) {
      throw new TourExecutionVersionConflictError();
    }

    let outboxEventType: string | null = null;
    if (input.targetState === "in_progress") {
      outboxEventType = "tour.execution.started";
    } else if (input.targetState === "completed") {
      outboxEventType = "tour.execution.completed";
    }

    if (outboxEventType !== null) {
      const domainEventId = `${outboxEventType}:${execution.id}:${now.toISOString()}`;
      await tx.outboxEvent.create({
        data: {
          tenantId: input.auth.tenantId,
          aggregateType: "tour_execution",
          aggregateId: execution.id,
          eventType: outboxEventType,
          domainEventId,
          correlationId: domainEventId,
          payload: {
            tourId: execution.tourId,
            executionId: execution.id,
            state: input.targetState,
            actorUserId: input.auth.userId,
            occurredAt: now.toISOString(),
          },
        },
      });
    }

    await appendAuditEvent(tx, {
      action: "TOUR_EXECUTION_STATE_CHANGED",
      entityType: "tour_execution",
      entityId: execution.id,
      metadata: { from: current, to: input.targetState },
    });
  });

  const view = await loadExecutionView(input.auth.tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function replaceTourExecutionGroups(input: {
  auth: TenantAuthContext;
  tourId: string;
  groups: ReadonlyArray<{ readonly name: string; readonly leaderUserId?: string | null }>;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  assertTourExecutionMutate(input.auth, execution);

  await withTenantRls(input.auth.tenantId, async (tx) => {
    await tx.tourExecutionGroup.deleteMany({
      where: { tenantId: input.auth.tenantId, executionId: execution.id },
    });
    let sort = 0;
    for (const group of input.groups) {
      const name = group.name.trim();
      if (name.length === 0) {
        continue;
      }
      await tx.tourExecutionGroup.create({
        data: {
          tenantId: input.auth.tenantId,
          executionId: execution.id,
          name,
          leaderUserId: group.leaderUserId ?? null,
          sortOrder: sort++,
        },
      });
    }
    await tx.tourExecution.updateMany({
      where: { id: execution.id, tenantId: input.auth.tenantId },
      data: { rowVersion: { increment: 1 } },
    });
  });

  const view = await loadExecutionView(input.auth.tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function assignManifestRowGroup(input: {
  auth: TenantAuthContext;
  tourId: string;
  registrationId: string;
  groupId: string | null;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  assertTourExecutionMutate(input.auth, execution);

  await withTenantRls(input.auth.tenantId, async (tx) => {
    if (input.groupId !== null) {
      const group = await tx.tourExecutionGroup.findFirst({
        where: {
          id: input.groupId,
          tenantId: input.auth.tenantId,
          executionId: execution.id,
        },
      });
      if (group === null) {
        throw new TourExecutionNotFoundError();
      }
    }
    await tx.tourExecutionManifestRow.updateMany({
      where: {
        tenantId: input.auth.tenantId,
        executionId: execution.id,
        registrationId: input.registrationId,
      },
      data: { groupId: input.groupId },
    });
  });

  const view = await loadExecutionView(input.auth.tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function toggleTourExecutionChecklistItem(input: {
  auth: TenantAuthContext;
  tourId: string;
  itemId: string;
  completed: boolean;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  assertTourExecutionMutate(input.auth, execution);

  await withTenantRls(input.auth.tenantId, async (tx) => {
    const item = await tx.tourExecutionChecklistItem.findFirst({
      where: {
        id: input.itemId,
        tenantId: input.auth.tenantId,
        executionId: execution.id,
      },
    });
    if (item === null) {
      throw new TourExecutionNotFoundError();
    }
    await tx.tourExecutionChecklistItem.updateMany({
      where: { id: item.id, tenantId: input.auth.tenantId },
      data: {
        completedAt: input.completed ? new Date() : null,
        completedByUserId: input.completed ? input.auth.userId : null,
      },
    });
  });

  const view = await loadExecutionView(input.auth.tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function createTourExecutionOperationalEvent(input: {
  auth: TenantAuthContext;
  tourId: string;
  eventKind: string;
  severity?: string;
  description: string;
  metadata?: Readonly<Record<string, unknown>>;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  assertTourExecutionMutate(input.auth, execution);
  if (execution.state === "completed" || execution.state === "cancelled") {
    throw new TourExecutionInvalidStateError(execution.state);
  }

  await withTenantRls(input.auth.tenantId, async (tx) => {
    await tx.tourExecutionOperationalEvent.create({
      data: {
        tenantId: input.auth.tenantId,
        executionId: execution.id,
        eventKind: input.eventKind.trim(),
        severity: input.severity?.trim() || "info",
        description: input.description.trim(),
        reportedByUserId: input.auth.userId,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  });

  const view = await loadExecutionView(input.auth.tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

async function applyExecutionChange(input: {
  auth: TenantAuthContext;
  tourId: string;
  changeKind: TourExecutionChangeKind;
  newValue: Readonly<Record<string, unknown>>;
  previousValue: Readonly<Record<string, unknown>> | null;
  idempotencyKey?: string;
  patchExecution: Prisma.TourExecutionUpdateManyMutationInput;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  assertTourExecutionMutate(input.auth, execution);

  const now = new Date();
  const domainEventId = `tour.execution.change.notified:${execution.id}:${input.changeKind}:${now.toISOString()}`;

  await withTenantRls(input.auth.tenantId, async (tx) => {
    if (input.idempotencyKey) {
      const existing = await tx.tourExecutionChangeLog.findFirst({
        where: {
          tenantId: input.auth.tenantId,
          executionId: execution.id,
          idempotencyKey: input.idempotencyKey,
        },
      });
      if (existing !== null) {
        return;
      }
    }

    await tx.tourExecution.updateMany({
      where: { id: execution.id, tenantId: input.auth.tenantId },
      data: { ...input.patchExecution, rowVersion: { increment: 1 } },
    });

    await tx.tourExecutionChangeLog.create({
      data: {
        tenantId: input.auth.tenantId,
        executionId: execution.id,
        changeType: input.changeKind,
        previousValue: input.previousValue as Prisma.InputJsonValue,
        newValue: input.newValue as Prisma.InputJsonValue,
        actorUserId: input.auth.userId,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });

    await tx.outboxEvent.create({
      data: {
        tenantId: input.auth.tenantId,
        aggregateType: "tour_execution",
        aggregateId: execution.id,
        eventType: "tour.execution.change.notified",
        domainEventId,
        correlationId: domainEventId,
        payload: {
          tourId: execution.tourId,
          executionId: execution.id,
          changeKind: input.changeKind,
          previousValue: input.previousValue,
          newValue: input.newValue,
          actorUserId: input.auth.userId,
          occurredAt: now.toISOString(),
        },
      },
    });
  });

  const view = await loadExecutionView(input.auth.tenantId, execution.id);
  if (view === null) {
    throw new TourExecutionNotFoundError();
  }
  return view;
}

export async function patchTourExecutionSchedule(input: {
  auth: TenantAuthContext;
  tourId: string;
  scheduledMeetingAt: string;
  idempotencyKey?: string;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  const previous = { scheduledMeetingAt: toIso(execution.scheduledMeetingAt) };
  const nextAt = new Date(input.scheduledMeetingAt);
  if (Number.isNaN(nextAt.getTime())) {
    throw new Error("TOUR_EXECUTION_INVALID_SCHEDULE");
  }
  return applyExecutionChange({
    auth: input.auth,
    tourId: input.tourId,
    changeKind: "schedule",
    previousValue: previous,
    newValue: { scheduledMeetingAt: nextAt.toISOString() },
    idempotencyKey: input.idempotencyKey,
    patchExecution: { scheduledMeetingAt: nextAt },
  });
}

export async function patchTourExecutionLocation(input: {
  auth: TenantAuthContext;
  tourId: string;
  meetingLocation: string;
  idempotencyKey?: string;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  const trimmed = input.meetingLocation.trim();
  return applyExecutionChange({
    auth: input.auth,
    tourId: input.tourId,
    changeKind: "location",
    previousValue: { meetingLocation: execution.meetingLocation },
    newValue: { meetingLocation: trimmed },
    idempotencyKey: input.idempotencyKey,
    patchExecution: { meetingLocation: trimmed },
  });
}

export async function patchTourExecutionTourLeader(input: {
  auth: TenantAuthContext;
  tourId: string;
  tourLeaderUserId: string | null;
  idempotencyKey?: string;
}): Promise<TourExecutionView> {
  const execution = await findActiveExecution(input.auth.tenantId, input.tourId);
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  return applyExecutionChange({
    auth: input.auth,
    tourId: input.tourId,
    changeKind: "tour_leader",
    previousValue: { tourLeaderUserId: execution.tourLeaderUserId },
    newValue: { tourLeaderUserId: input.tourLeaderUserId },
    idempotencyKey: input.idempotencyKey,
    patchExecution: { tourLeaderUserId: input.tourLeaderUserId },
  });
}

export async function getMemberTourExecutionSummary(input: {
  tenantId: string;
  userId: string;
  tourId: string;
}): Promise<MemberTourExecutionSummaryView | null> {
  return withTenantRls(input.tenantId, async (tx) => {
    const registration = await tx.operatorRegistration.findFirst({
      where: {
        tenantId: input.tenantId,
        tourId: input.tourId,
        submittedByUserId: input.userId,
        status: "approved",
      },
    });
    if (registration === null) {
      return null;
    }

    const execution = await tx.tourExecution.findFirst({
      where: {
        tenantId: input.tenantId,
        tourId: input.tourId,
        state: { notIn: ["cancelled"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (execution === null) {
      return null;
    }

    const manifestRow = await tx.tourExecutionManifestRow.findFirst({
      where: {
        tenantId: input.tenantId,
        executionId: execution.id,
        registrationId: registration.id,
      },
    });

    return {
      tourId: input.tourId,
      state: execution.state as TourExecutionState,
      scheduledMeetingAt: toIso(execution.scheduledMeetingAt),
      meetingLocation: execution.meetingLocation,
      registrationId: registration.id,
      guestLabel: registration.guestLabel,
      paymentStatus: manifestRow?.paymentStatus ?? registration.paymentStatus,
      insuranceStatus: manifestRow?.insuranceStatus ?? deriveInsuranceStatus(registration.registrationIntake),
      attendanceStatus: registration.attendanceStatus,
    };
  });
}

/** Test helper */
export async function deleteTourExecutionForTests(tenantId: string, tourId: string): Promise<void> {
  const prisma = getPrismaAdmin();
  await prisma.tourExecution.deleteMany({ where: { tenantId, tourId } });
}
