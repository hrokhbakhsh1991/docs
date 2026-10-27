/**
 * FIFO waitlist promotion after an approved seat is released (DP-1 / DP-4 shared).
 */
import { getBookingsRepository } from "./create-bookings-repository.ts";
import { resolveBookingWorkspaceTypeForTenant } from "./resolve-booking-workspace-type-for-tenant.ts";
import { resolveBookingWorkspaceDependencies } from "./booking-dependency-registry.ts";
import { HostBookingTourCapacityAdapter } from "./infrastructure/host-booking-tour-capacity.adapter.ts";
import { setBookingPaymentDueAtProjection } from "./in-memory-bookings.repository.ts";
import { applyPaymentHoldAfterBookingApprove } from "../finance/apply-payment-hold-after-booking-approve.ts";
import type { BookingRecord } from "./bookings.types.ts";
import { BOOKING_TRANSPORT_CAPACITY_REJECTED } from "@app-tour/booking-http-contracts";
import { BookingStatusConflictError } from "./bookings.errors.ts";

async function buildPromotionCapacityAssert(tenantId: string, tourId: string) {
  const [workspaceType, tourCapacityMax] = await Promise.all([
    resolveBookingWorkspaceTypeForTenant(tenantId),
    new HostBookingTourCapacityAdapter().resolveTourCapacityMax(tenantId, tourId),
  ]);
  const { capacityPolicy } = resolveBookingWorkspaceDependencies(workspaceType);
  return (ctx: {
    readonly booking: BookingRecord;
    readonly occupiedApprovedPartySize: number;
    readonly approvedCapacitySnapshots: readonly import("@app-tour/booking-http-contracts").BookingApprovedCapacitySnapshot[];
  }) =>
    capacityPolicy.assertCreateCapacity({
      tenantId,
      tourId: ctx.booking.tourId,
      tourTitle: ctx.booking.tourTitle,
      guestLabel: ctx.booking.guestLabel,
      ...(ctx.booking.guestEmail === null ? {} : { guestEmail: ctx.booking.guestEmail }),
      ...(ctx.booking.guestPhone === null ? {} : { guestPhone: ctx.booking.guestPhone }),
      partySize: ctx.booking.partySize,
      departureAt: ctx.booking.departureAt,
      registrationIntake: {
        ...(ctx.booking.registrationIntake ?? {}),
        ...(tourCapacityMax === null ? {} : { tourCapacityMax }),
      },
      occupiedApprovedPartySize: ctx.occupiedApprovedPartySize,
      approvedCapacitySnapshots: ctx.approvedCapacitySnapshots,
      tourCapacityMax,
    });
}

export async function promoteOldestWaitlistedGuest(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<string | null> {
  const repo = getBookingsRepository();
  const waitlisted = (await repo.listByTenant(input.tenantId))
    .filter((row) => row.tourId === input.tourId && row.status === "waitlisted")
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
  const candidateSummary = waitlisted[0];
  if (candidateSummary === undefined) {
    return null;
  }
  // List projections intentionally strip registrationIntake. Capacity policy
  // decisions (especially transport seats) require the complete persisted row.
  const candidate = await repo.getById(candidateSummary.id, input.tenantId);
  if (candidate === null || candidate.status !== "waitlisted") {
    return null;
  }

  const assertCapacityInTx = await buildPromotionCapacityAssert(input.tenantId, candidate.tourId);
  let approved;
  try {
    approved = await repo.approveWithOutbox({
      bookingId: candidate.id,
      tenantId: input.tenantId,
      outboxEvent: "registration.approved",
      assertCapacityInTx,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error instanceof BookingStatusConflictError ||
        error.message.startsWith("BOOKING_CAPACITY_REJECTED") ||
        error.message.startsWith(BOOKING_TRANSPORT_CAPACITY_REJECTED))
    ) {
      return null;
    }
    throw error;
  }
  const sideEffects = await applyPaymentHoldAfterBookingApprove({
    tenantId: input.tenantId,
    bookingId: approved.id,
    approvedAt: approved.approvedAt ?? new Date().toISOString(),
  });
  if (sideEffects.paymentDueAt !== undefined) {
    setBookingPaymentDueAtProjection({
      tenantId: input.tenantId,
      bookingId: approved.id,
      paymentDueAt: sideEffects.paymentDueAt,
    });
  }
  return approved.id;
}

/**
 * Promote every currently eligible FIFO waitlist row. Each attempt rechecks
 * capacity in its own locked transaction, so an older row that needs a car
 * seat cannot block a later independently transportable guest forever.
 */
export async function promoteAvailableWaitlistedGuests(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<readonly string[]> {
  const repo = getBookingsRepository();
  const promoted: string[] = [];
  const candidates = (await repo.listByTenant(input.tenantId))
    .filter((row) => row.tourId === input.tourId && row.status === "waitlisted")
    .sort(
      (left, right) =>
        left.submittedAt.localeCompare(right.submittedAt) || left.id.localeCompare(right.id)
    );

  for (const candidateSummary of candidates) {
    // listByTenant is a privacy-safe projection and omits registrationIntake;
    // rehydrate before evaluating transport-specific capacity.
    const candidate = await repo.getById(candidateSummary.id, input.tenantId);
    if (candidate === null || candidate.status !== "waitlisted") continue;
    const assertCapacityInTx = await buildPromotionCapacityAssert(input.tenantId, candidate.tourId);
    try {
      const approved = await repo.approveWithOutbox({
        bookingId: candidate.id,
        tenantId: input.tenantId,
        outboxEvent: "registration.approved",
        assertCapacityInTx,
      });
      const sideEffects = await applyPaymentHoldAfterBookingApprove({
        tenantId: input.tenantId,
        bookingId: approved.id,
        approvedAt: approved.approvedAt ?? new Date().toISOString(),
      });
      if (sideEffects.paymentDueAt !== undefined) {
        setBookingPaymentDueAtProjection({
          tenantId: input.tenantId,
          bookingId: approved.id,
          paymentDueAt: sideEffects.paymentDueAt,
        });
      }
      promoted.push(approved.id);
    } catch (error) {
      if (
        error instanceof Error &&
        (error instanceof BookingStatusConflictError ||
          error.message.startsWith("BOOKING_CAPACITY_REJECTED") ||
          error.message.startsWith(BOOKING_TRANSPORT_CAPACITY_REJECTED))
      ) {
        continue;
      }
      throw error;
    }
  }
  return promoted;
}
