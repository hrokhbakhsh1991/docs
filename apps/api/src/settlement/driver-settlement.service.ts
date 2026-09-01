/**
 * DP-5 — driver settlement orchestration service.
 */
import {
  assertDriverSettlementTransition,
  buildSettlementIdempotencyKey,
  calculateDriverSettlement,
  countAssignedPassengers,
  validateTransportAllocations,
  type DriverSettlement,
  type RosterParticipant,
  type TransportAllocation,
  type TransportAllocationInput,
} from "../workspace/denali-host-legacy-bindings.generated.ts";

import { listBookings } from "../bookings/create-bookings-service.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import {
  createPayableId,
  findPayableById,
  findPayableByIdempotencyKey,
  findPayableBySettlementId,
  insertDriverPayable,
  listDriverPayables,
  updateDriverPayable,
  type DriverPayable,
} from "../finance/driver-payable.repository.ts";
import {
  createSettlementId,
  findSettlementById,
  findSettlementByIdempotencyKey,
  insertSettlement,
  listSettlementsForTour,
  updateSettlement,
  voidSettlementsForTour,
} from "./driver-settlement.repository.ts";
import {
  freezeTourRoster,
  getTourRosterFreeze,
  isTourRosterFrozen,
  listTransportAllocations,
  replaceTransportAllocations,
  removeAllocationsForPassenger,
  removeAllocationsForDriver,
  clearAllocationsForTour,
  type TourRosterFreeze,
} from "../transport/transport-allocation.repository.ts";

export type ReplaceAllocationsResult = {
  readonly allocations: readonly TransportAllocation[];
};

export type FreezeRosterResult = {
  readonly freeze: TourRosterFreeze;
  readonly settlements: readonly DriverSettlement[];
  readonly replay: boolean;
};

async function loadOperationalParticipants(
  auth: BookingActorContext,
  tourId: string
): Promise<RosterParticipant[]> {
  const bookings = await listBookings(auth, {
    view: "ops",
    tourId,
    status: "approved",
    limit: 500,
    sort: "submittedAt",
  });
  return bookings.items.map((row) => ({
    registrationId: row.id,
    status: row.status,
    transportKind: row.transportKind ?? null,
    personalCarOccupants: row.personalCarOccupants ?? null,
  }));
}

export async function getTransportAllocationsForTour(
  auth: BookingActorContext,
  tourId: string
): Promise<readonly TransportAllocation[]> {
  return listTransportAllocations(auth.tenantId, tourId);
}

export async function putTransportAllocations(
  auth: BookingActorContext,
  tourId: string,
  allocations: readonly TransportAllocationInput[]
): Promise<ReplaceAllocationsResult> {
  const participants = await loadOperationalParticipants(auth, tourId);
  const validation = validateTransportAllocations({
    tourId,
    allocations,
    participants,
    rosterFrozen: isTourRosterFrozen(auth.tenantId, tourId),
  });
  if (!validation.ok) {
    throw Object.assign(new Error(validation.message), { code: validation.code, statusCode: 409 });
  }
  const nowIso = new Date().toISOString();
  const created = replaceTransportAllocations({
    tenantId: auth.tenantId,
    tourId,
    actorUserId: auth.userId,
    allocations,
    nowIso,
  });
  return { allocations: created };
}

export async function freezeTourRosterAndGenerateSettlements(
  auth: BookingActorContext,
  tourId: string,
  input: { readonly driverCompensationPerSeatMinor: string; readonly currency: string }
): Promise<FreezeRosterResult> {
  const nowIso = new Date().toISOString();
  const existingFreeze = getTourRosterFreeze(auth.tenantId, tourId);
  if (existingFreeze !== null) {
    return {
      freeze: existingFreeze,
      settlements: listSettlementsForTour(auth.tenantId, tourId),
      replay: true,
    };
  }

  const participants = await loadOperationalParticipants(auth, tourId);
  const drivers = participants.filter((p) => p.transportKind === "personal_car");
  const allocations = listTransportAllocations(auth.tenantId, tourId);
  const allocInputs: TransportAllocationInput[] = allocations.map((a) => ({
    driverRegistrationId: a.driverRegistrationId,
    passengerRegistrationId: a.passengerRegistrationId,
  }));

  const freeze = freezeTourRoster({
    tenantId: auth.tenantId,
    tourId,
    actorUserId: auth.userId,
    driverCompensationPerSeatMinor: input.driverCompensationPerSeatMinor,
    currency: input.currency,
    nowIso,
  });

  const settlements: DriverSettlement[] = [];
  for (const driver of drivers) {
    const offeredSeats = driver.personalCarOccupants ?? 0;
    const assignedPassengers = countAssignedPassengers(allocInputs, driver.registrationId);
    const calc = calculateDriverSettlement({
      offeredSeats,
      assignedPassengers,
      unitAmountMinor: input.driverCompensationPerSeatMinor,
      currency: input.currency,
    });
    const idempotencyKey = buildSettlementIdempotencyKey({
      tourId,
      driverRegistrationId: driver.registrationId,
      rosterFrozenAt: freeze.frozenAt,
    });
    const existing = findSettlementByIdempotencyKey(auth.tenantId, idempotencyKey);
    if (existing !== null) {
      settlements.push(existing);
      continue;
    }
    const settlementId = createSettlementId();
    const row: DriverSettlement = {
      settlementId,
      tenantId: auth.tenantId,
      tourId,
      driverRegistrationId: driver.registrationId,
      offeredSeats,
      assignedPassengers,
      billableQuantity: calc.billableQuantity,
      unitAmountMinor: input.driverCompensationPerSeatMinor,
      currency: input.currency,
      totalMinor: calc.totalMinor,
      status: "draft",
      basis: "assigned_at_freeze",
      payableTrigger: "operator_confirm",
      correctionOfSettlementId: null,
      financePayableId: null,
      approvedByUserId: null,
      rosterFrozenAt: freeze.frozenAt,
      confirmedAt: null,
      finalizedAt: null,
      paidAt: null,
      idempotencyKey,
      audit: [
        {
          at: nowIso,
          actorUserId: auth.userId,
          action: "draft_created",
          detail: `billable=${calc.billableQuantity}`,
        },
      ],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    settlements.push(insertSettlement(row));
  }

  return { freeze, settlements, replay: false };
}

export async function listDriverSettlementsForTour(
  auth: BookingActorContext,
  tourId: string
): Promise<readonly DriverSettlement[]> {
  return listSettlementsForTour(auth.tenantId, tourId);
}

export async function confirmDriverSettlement(
  auth: BookingActorContext,
  tourId: string,
  settlementId: string
): Promise<DriverSettlement> {
  const row = findSettlementById(auth.tenantId, settlementId);
  if (row === null || row.tourId !== tourId) {
    throw Object.assign(new Error("Settlement not found"), { code: "SETTLEMENT_NOT_FOUND", statusCode: 404 });
  }
  if (row.status === "confirmed") {
    return row;
  }
  assertDriverSettlementTransition(row.status, "confirmed");
  const nowIso = new Date().toISOString();
  return updateSettlement(auth.tenantId, settlementId, {
    status: "confirmed",
    confirmedAt: nowIso,
    auditAppend: { at: nowIso, actorUserId: auth.userId, action: "confirmed" },
  });
}

export async function approveDriverSettlementPayable(
  auth: BookingActorContext,
  tourId: string,
  settlementId: string
): Promise<{ readonly settlement: DriverSettlement; readonly payable: DriverPayable; readonly replay: boolean }> {
  let settlement = findSettlementById(auth.tenantId, settlementId);
  if (settlement === null || settlement.tourId !== tourId) {
    throw Object.assign(new Error("Settlement not found"), { code: "SETTLEMENT_NOT_FOUND", statusCode: 404 });
  }

  if (settlement.status === "draft") {
    settlement = await confirmDriverSettlement(auth, tourId, settlementId);
  }

  const existingPayable = findPayableBySettlementId(auth.tenantId, settlementId);
  if (existingPayable !== null) {
    return { settlement, payable: existingPayable, replay: true };
  }

  if (settlement.status === "payable" && settlement.financePayableId !== null) {
    const payable = findPayableBySettlementId(auth.tenantId, settlementId);
    if (payable !== null) {
      return { settlement, payable, replay: true };
    }
  }

  assertDriverSettlementTransition(settlement.status, "payable");
  const nowIso = new Date().toISOString();
  const payableIdempotencyKey = `payable:${settlement.settlementId}`;
  const replayPayable = findPayableByIdempotencyKey(auth.tenantId, payableIdempotencyKey);
  if (replayPayable !== null) {
    return { settlement, payable: replayPayable, replay: true };
  }

  const payableId = createPayableId();
  const payable: DriverPayable = {
    payableId,
    tenantId: auth.tenantId,
    settlementId: settlement.settlementId,
    tourId: settlement.tourId,
    driverRegistrationId: settlement.driverRegistrationId,
    amountMinor: settlement.totalMinor,
    currency: settlement.currency,
    status: "Approved",
    evidenceNote: null,
    evidenceFileKey: null,
    requestedAt: nowIso,
    requestedByUserId: auth.userId,
    completedAt: null,
    completedByUserId: null,
    idempotencyKey: payableIdempotencyKey,
  };
  insertDriverPayable(payable);

  const updated = updateSettlement(auth.tenantId, settlementId, {
    status: "payable",
    financePayableId: payableId,
    approvedByUserId: auth.userId,
    finalizedAt: nowIso,
    auditAppend: { at: nowIso, actorUserId: auth.userId, action: "payable_opened", detail: payableId },
  });

  return { settlement: updated, payable, replay: false };
}

export async function completeDriverPayable(
  auth: BookingActorContext,
  payableId: string,
  input: { readonly evidenceNote?: string; readonly evidenceFileKey?: string }
): Promise<{ readonly payable: DriverPayable; readonly settlement: DriverSettlement; readonly replay: boolean }> {
  const row = findPayableById(auth.tenantId, payableId);
  if (row === null) {
    throw Object.assign(new Error("Payable not found"), { code: "DRIVER_PAYABLE_NOT_FOUND", statusCode: 404 });
  }

  if (row.status === "Completed") {
    const settlement = findSettlementById(auth.tenantId, row.settlementId);
    if (settlement === null) {
      throw new Error("SETTLEMENT_NOT_FOUND");
    }
    return { payable: row, settlement, replay: true };
  }

  const nowIso = new Date().toISOString();
  const updatedPayable = updateDriverPayable(auth.tenantId, payableId, {
    status: "Completed",
    completedAt: nowIso,
    completedByUserId: auth.userId,
    evidenceNote: input.evidenceNote ?? null,
    evidenceFileKey: input.evidenceFileKey ?? null,
  });

  const settlement = findSettlementById(auth.tenantId, row.settlementId);
  if (settlement === null) {
    throw new Error("SETTLEMENT_NOT_FOUND");
  }

  if (settlement.status === "paid") {
    return { payable: updatedPayable, settlement, replay: true };
  }

  assertDriverSettlementTransition(settlement.status, "paid");
  const updatedSettlement = updateSettlement(auth.tenantId, settlement.settlementId, {
    status: "paid",
    paidAt: nowIso,
    auditAppend: { at: nowIso, actorUserId: auth.userId, action: "paid", detail: payableId },
  });

  return { payable: updatedPayable, settlement: updatedSettlement, replay: false };
}

export async function listDriverPayablesForTenant(
  auth: BookingActorContext
): Promise<readonly DriverPayable[]> {
  return listDriverPayables(auth.tenantId);
}

export async function handlePassengerCancelledForSettlement(
  auth: BookingActorContext,
  passengerRegistrationId: string
): Promise<void> {
  removeAllocationsForPassenger(auth.tenantId, passengerRegistrationId);
}

export async function handleDriverCancelledForSettlement(
  auth: BookingActorContext,
  tourId: string,
  driverRegistrationId: string
): Promise<void> {
  removeAllocationsForDriver(auth.tenantId, tourId, driverRegistrationId);
  const nowIso = new Date().toISOString();
  for (const row of listSettlementsForTour(auth.tenantId, tourId)) {
    if (row.driverRegistrationId !== driverRegistrationId) {
      continue;
    }
    if (row.status === "paid" || row.status === "voided") {
      continue;
    }
    updateSettlement(auth.tenantId, row.settlementId, {
      status: "voided",
      auditAppend: { at: nowIso, actorUserId: auth.userId, action: "voided_driver_cancel" },
    });
  }
}

export async function handleTourCancelledForSettlement(
  auth: BookingActorContext,
  tourId: string
): Promise<void> {
  clearAllocationsForTour(auth.tenantId, tourId);
  voidSettlementsForTour(auth.tenantId, tourId, auth.userId);
}

export async function createCorrectionSettlement(
  auth: BookingActorContext,
  tourId: string,
  originalSettlementId: string,
  input: { readonly billableQuantity: number; readonly unitAmountMinor: string; readonly currency: string }
): Promise<DriverSettlement> {
  const original = findSettlementById(auth.tenantId, originalSettlementId);
  if (original === null || original.tourId !== tourId) {
    throw Object.assign(new Error("Settlement not found"), { code: "SETTLEMENT_NOT_FOUND", statusCode: 404 });
  }
  if (original.status !== "paid" && original.status !== "payable") {
    throw Object.assign(new Error("Correction requires paid or payable settlement"), {
      code: "SETTLEMENT_CORRECTION_INVALID",
      statusCode: 409,
    });
  }

  const freeze = getTourRosterFreeze(auth.tenantId, tourId);
  const rosterFrozenAt = freeze?.frozenAt ?? original.rosterFrozenAt ?? new Date().toISOString();
  const calc = calculateDriverSettlement({
    offeredSeats: original.offeredSeats,
    assignedPassengers: input.billableQuantity,
    unitAmountMinor: input.unitAmountMinor,
    currency: input.currency,
  });
  const idempotencyKey = buildSettlementIdempotencyKey({
    tourId,
    driverRegistrationId: original.driverRegistrationId,
    rosterFrozenAt,
    correctionOfSettlementId: originalSettlementId,
  });
  const existing = findSettlementByIdempotencyKey(auth.tenantId, idempotencyKey);
  if (existing !== null) {
    return existing;
  }

  const nowIso = new Date().toISOString();
  const settlementId = createSettlementId();
  const row: DriverSettlement = {
    settlementId,
    tenantId: auth.tenantId,
    tourId,
    driverRegistrationId: original.driverRegistrationId,
    offeredSeats: original.offeredSeats,
    assignedPassengers: input.billableQuantity,
    billableQuantity: calc.billableQuantity,
    unitAmountMinor: input.unitAmountMinor,
    currency: input.currency,
    totalMinor: calc.totalMinor,
    status: "draft",
    basis: "assigned_at_freeze",
    payableTrigger: "operator_confirm",
    correctionOfSettlementId: originalSettlementId,
    financePayableId: null,
    approvedByUserId: null,
    rosterFrozenAt,
    confirmedAt: null,
    finalizedAt: null,
    paidAt: null,
    idempotencyKey,
    audit: [
      {
        at: nowIso,
        actorUserId: auth.userId,
        action: "correction_created",
        detail: `of=${originalSettlementId}`,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return insertSettlement(row);
}

export async function recalculateDraftSettlementsBeforePayable(
  auth: BookingActorContext,
  tourId: string
): Promise<readonly DriverSettlement[]> {
  if (isTourRosterFrozen(auth.tenantId, tourId)) {
    return listSettlementsForTour(auth.tenantId, tourId);
  }
  const freeze = getTourRosterFreeze(auth.tenantId, tourId);
  if (freeze === null) {
    return [];
  }
  const participants = await loadOperationalParticipants(auth, tourId);
  const drivers = participants.filter((p) => p.transportKind === "personal_car");
  const allocations = listTransportAllocations(auth.tenantId, tourId);
  const allocInputs = allocations.map((a) => ({
    driverRegistrationId: a.driverRegistrationId,
    passengerRegistrationId: a.passengerRegistrationId,
  }));
  const updated: DriverSettlement[] = [];
  for (const driver of drivers) {
    for (const row of listSettlementsForTour(auth.tenantId, tourId)) {
      if (row.driverRegistrationId !== driver.registrationId || row.status !== "draft") {
        continue;
      }
      const assignedPassengers = countAssignedPassengers(allocInputs, driver.registrationId);
      const calc = calculateDriverSettlement({
        offeredSeats: row.offeredSeats,
        assignedPassengers,
        unitAmountMinor: row.unitAmountMinor,
        currency: row.currency,
      });
      updated.push(
        updateSettlement(auth.tenantId, row.settlementId, {
          assignedPassengers,
          billableQuantity: calc.billableQuantity,
          totalMinor: calc.totalMinor,
          auditAppend: {
            at: new Date().toISOString(),
            actorUserId: auth.userId,
            action: "recalculated",
          },
        })
      );
    }
  }
  return updated;
}
