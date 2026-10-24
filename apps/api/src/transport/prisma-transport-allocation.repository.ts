/** Prisma-backed transport assignments for multi-process and restart-safe roster reads. */
import { Prisma } from "@prisma/client";

import type {
  RosterParticipant,
  TransportAllocation,
  TransportAllocationInput,
} from "@app-tour/workspace-denali/transport";
import { validateTransportAllocations } from "@app-tour/workspace-denali/transport";
import { acquireTourCapacityLock } from "../bookings/prisma-bookings.repository.ts";
import { withTenantRls } from "../db/with-tenant-rls.ts";
import {
  readPersonalCarOccupantsFromIntake,
  readTransportKindFromIntake,
} from "../bookings/read-transport-kind-from-intake.ts";
import type { TourRosterFreeze, TourRosterSnapshot } from "./transport-allocation.repository.ts";

function toDomain(row: {
  id: string;
  tenantId: string;
  tourId: string;
  driverRegistrationId: string;
  passengerRegistrationId: string;
  createdAt: Date;
  createdByUserId: string;
}): TransportAllocation {
  return {
    allocationId: row.id,
    tenantId: row.tenantId,
    tourId: row.tourId,
    driverRegistrationId: row.driverRegistrationId,
    passengerRegistrationId: row.passengerRegistrationId,
    createdAt: row.createdAt.toISOString(),
    createdByUserId: row.createdByUserId,
  };
}

export async function listPrismaTransportAllocations(
  tenantId: string,
  tourId: string
): Promise<readonly TransportAllocation[]> {
  return withTenantRls(tenantId, async (tx) => {
    const rows = await tx.transportAllocation.findMany({
      where: { tenantId, tourId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toDomain);
  });
}

export async function replacePrismaTransportAllocations(input: {
  tenantId: string;
  tourId: string;
  actorUserId: string;
  allocations: readonly TransportAllocationInput[];
}): Promise<readonly TransportAllocation[]> {
  return withTenantRls(input.tenantId, async (tx) => {
    await acquireTourCapacityLock(tx, input.tenantId, input.tourId);
    const freeze = await tx.transportRosterFreeze.findUnique({
      where: { tenantId_tourId: { tenantId: input.tenantId, tourId: input.tourId } },
      select: { tourId: true },
    });
    if (freeze !== null) {
      throw Object.assign(new Error("Transport roster is frozen"), {
        code: "TRANSPORT_ROSTER_FROZEN",
        statusCode: 409,
      });
    }
    const registrations = await tx.operatorRegistration.findMany({
      where: { tenantId: input.tenantId, tourId: input.tourId, status: "approved" },
      select: { id: true, status: true, partySize: true, registrationIntake: true },
    });
    const validation = validateTransportAllocations({
      tourId: input.tourId,
      allocations: input.allocations,
      rosterFrozen: false,
      participants: registrations.map((row) => {
        const intake = row.registrationIntake as Record<string, unknown> | null;
        return {
          registrationId: row.id,
          status: row.status,
          partySize: row.partySize,
          transportKind: readTransportKindFromIntake(intake),
          personalCarOccupants: readPersonalCarOccupantsFromIntake(intake),
        };
      }),
    });
    if (!validation.ok) {
      throw Object.assign(new Error(validation.message), {
        code: validation.code,
        statusCode: 409,
      });
    }
    await tx.transportAllocation.deleteMany({
      where: { tenantId: input.tenantId, tourId: input.tourId },
    });
    if (input.allocations.length > 0) {
      await tx.transportAllocation.createMany({
        data: input.allocations.map((row) => ({
          tenantId: input.tenantId,
          tourId: input.tourId,
          driverRegistrationId: row.driverRegistrationId,
          passengerRegistrationId: row.passengerRegistrationId,
          createdByUserId: input.actorUserId,
        })),
      });
    }
    const rows = await tx.transportAllocation.findMany({
      where: { tenantId: input.tenantId, tourId: input.tourId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toDomain);
  });
}

export async function isPrismaTourRosterFrozen(tenantId: string, tourId: string): Promise<boolean> {
  return withTenantRls(
    tenantId,
    async (tx) =>
      (await tx.transportRosterFreeze.findUnique({
        where: { tenantId_tourId: { tenantId, tourId } },
        select: { tourId: true },
      })) !== null
  );
}

export async function getPrismaTourRosterFreeze(tenantId: string, tourId: string) {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.transportRosterFreeze.findUnique({
      where: { tenantId_tourId: { tenantId, tourId } },
    });
    return row === null
      ? null
      : {
          tenantId: row.tenantId,
          tourId: row.tourId,
          frozenAt: row.frozenAt.toISOString(),
          frozenByUserId: row.frozenByUserId,
          driverCompensationPerSeatMinor: row.driverCompensationPerSeatMinor,
          currency: row.currency,
          rosterSnapshot: readRosterSnapshot(row.rosterSnapshot),
        };
  });
}

function readRosterSnapshot(value: Prisma.JsonValue | null): TourRosterSnapshot | null {
  if (value === null) return null;
  const invalidSnapshot = (): never => {
    throw new Error("Stored transport roster snapshot is invalid");
  };
  if (typeof value !== "object" || Array.isArray(value)) invalidSnapshot();
  const record = value as Prisma.JsonObject;
  if (!Array.isArray(record.participants) || !Array.isArray(record.allocations)) {
    invalidSnapshot();
  }
  const rawParticipants = record.participants as Prisma.JsonArray;
  const rawAllocations = record.allocations as Prisma.JsonArray;
  const participants: RosterParticipant[] = [];
  for (const value of rawParticipants) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) invalidSnapshot();
    const row = value as Prisma.JsonObject;
    const registrationId = row.registrationId;
    const status = row.status;
    const partySize = row.partySize;
    const transportKind = row.transportKind;
    const personalCarOccupants = row.personalCarOccupants;
    if (
      typeof registrationId !== "string" ||
      typeof status !== "string" ||
      typeof partySize !== "number" ||
      !(typeof transportKind === "string" || transportKind === null) ||
      !(typeof personalCarOccupants === "number" || personalCarOccupants === null)
    ) {
      invalidSnapshot();
    }
    participants.push({
      registrationId: registrationId as string,
      status: status as string,
      partySize: partySize as number,
      transportKind: transportKind as RosterParticipant["transportKind"],
      personalCarOccupants: personalCarOccupants as number | null,
    });
  }
  const allocations: TransportAllocationInput[] = [];
  for (const value of rawAllocations) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) invalidSnapshot();
    const row = value as Prisma.JsonObject;
    const driverRegistrationId = row.driverRegistrationId;
    const passengerRegistrationId = row.passengerRegistrationId;
    if (typeof driverRegistrationId !== "string" || typeof passengerRegistrationId !== "string") {
      invalidSnapshot();
    }
    allocations.push({
      driverRegistrationId: driverRegistrationId as string,
      passengerRegistrationId: passengerRegistrationId as string,
    });
  }
  return { participants, allocations };
}

function toPrismaRosterFreeze(
  row: {
    tenantId: string;
    tourId: string;
    frozenAt: Date;
    frozenByUserId: string;
    driverCompensationPerSeatMinor: string;
    currency: string;
  },
  rosterSnapshot: TourRosterSnapshot | null
): TourRosterFreeze {
  return {
    tenantId: row.tenantId,
    tourId: row.tourId,
    frozenAt: row.frozenAt.toISOString(),
    frozenByUserId: row.frozenByUserId,
    driverCompensationPerSeatMinor: row.driverCompensationPerSeatMinor,
    currency: row.currency,
    rosterSnapshot,
  };
}

/** Freeze and capture the settlement basis under the same per-tour advisory lock. */
export async function freezePrismaTourRosterWithSnapshot(input: {
  tenantId: string;
  tourId: string;
  actorUserId: string;
  driverCompensationPerSeatMinor: string;
  currency: string;
  nowIso: string;
}): Promise<{ freeze: TourRosterFreeze; snapshot: TourRosterSnapshot; replay: boolean }> {
  return withTenantRls(input.tenantId, async (tx) => {
    await acquireTourCapacityLock(tx, input.tenantId, input.tourId);
    const existing = await tx.transportRosterFreeze.findUnique({
      where: { tenantId_tourId: { tenantId: input.tenantId, tourId: input.tourId } },
    });
    const [registrationRows, allocationRows] = await Promise.all([
      tx.operatorRegistration.findMany({
        where: { tenantId: input.tenantId, tourId: input.tourId, status: "approved" },
        select: { id: true, status: true, partySize: true, registrationIntake: true },
        orderBy: [{ approvedAt: "asc" }, { id: "asc" }],
      }),
      tx.transportAllocation.findMany({
        where: { tenantId: input.tenantId, tourId: input.tourId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ]);
    const currentSnapshot: TourRosterSnapshot = {
      participants: registrationRows.map((row) => {
        const intake = row.registrationIntake as Record<string, unknown> | null;
        return {
          registrationId: row.id,
          status: row.status,
          partySize: row.partySize,
          transportKind: readTransportKindFromIntake(intake),
          personalCarOccupants: readPersonalCarOccupantsFromIntake(intake),
        };
      }),
      allocations: allocationRows.map((row) => ({
        driverRegistrationId: row.driverRegistrationId,
        passengerRegistrationId: row.passengerRegistrationId,
      })),
    };
    const persistedSnapshot =
      existing === null ? null : readRosterSnapshot(existing.rosterSnapshot);
    const snapshot = persistedSnapshot ?? currentSnapshot;
    const row =
      existing === null
        ? await tx.transportRosterFreeze.create({
            data: {
              tenantId: input.tenantId,
              tourId: input.tourId,
              frozenAt: new Date(input.nowIso),
              frozenByUserId: input.actorUserId,
              driverCompensationPerSeatMinor: input.driverCompensationPerSeatMinor,
              currency: input.currency,
              rosterSnapshot: snapshot as unknown as Prisma.InputJsonValue,
            },
          })
        : persistedSnapshot === null
          ? await tx.transportRosterFreeze.update({
              where: { tenantId_tourId: { tenantId: input.tenantId, tourId: input.tourId } },
              data: { rosterSnapshot: snapshot as unknown as Prisma.InputJsonValue },
            })
          : existing;
    return {
      freeze: toPrismaRosterFreeze(row, snapshot),
      snapshot,
      replay: existing !== null,
    };
  });
}

export async function createPrismaTourRosterFreeze(input: {
  tenantId: string;
  tourId: string;
  actorUserId: string;
  driverCompensationPerSeatMinor: string;
  currency: string;
  nowIso: string;
}) {
  return withTenantRls(input.tenantId, async (tx) => {
    await acquireTourCapacityLock(tx, input.tenantId, input.tourId);
    const existing = await tx.transportRosterFreeze.findUnique({
      where: { tenantId_tourId: { tenantId: input.tenantId, tourId: input.tourId } },
    });
    const row =
      existing ??
      (await tx.transportRosterFreeze.create({
        data: {
          tenantId: input.tenantId,
          tourId: input.tourId,
          frozenAt: new Date(input.nowIso),
          frozenByUserId: input.actorUserId,
          driverCompensationPerSeatMinor: input.driverCompensationPerSeatMinor,
          currency: input.currency,
        },
      }));
    return {
      tenantId: row.tenantId,
      tourId: row.tourId,
      frozenAt: row.frozenAt.toISOString(),
      frozenByUserId: row.frozenByUserId,
      driverCompensationPerSeatMinor: row.driverCompensationPerSeatMinor,
      currency: row.currency,
    };
  });
}

export async function removePrismaAllocationsForPassenger(
  tenantId: string,
  passengerRegistrationId: string
) {
  return withTenantRls(tenantId, async (tx) => {
    const row = await tx.transportAllocation.findFirst({
      where: { tenantId, passengerRegistrationId },
      select: { tourId: true },
    });
    if (row === null) return;
    await acquireTourCapacityLock(tx, tenantId, row.tourId);
    await tx.transportAllocation.deleteMany({ where: { tenantId, passengerRegistrationId } });
  });
}

export async function removePrismaAllocationsForDriver(
  tenantId: string,
  tourId: string,
  driverRegistrationId: string
) {
  return withTenantRls(tenantId, async (tx) => {
    await acquireTourCapacityLock(tx, tenantId, tourId);
    await tx.transportAllocation.deleteMany({ where: { tenantId, tourId, driverRegistrationId } });
  });
}

export async function clearPrismaAllocationsForTour(tenantId: string, tourId: string) {
  return withTenantRls(tenantId, async (tx) => {
    await acquireTourCapacityLock(tx, tenantId, tourId);
    await tx.transportAllocation.deleteMany({ where: { tenantId, tourId } });
  });
}
