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

async function buildPromotionCapacityAssert(tenantId: string, candidate: BookingRecord) {
  const [workspaceType, tourCapacityMax] = await Promise.all([
    resolveBookingWorkspaceTypeForTenant(tenantId),
    new HostBookingTourCapacityAdapter().resolveTourCapacityMax(tenantId, candidate.tourId),
  ]);
  const { capacityPolicy } = resolveBookingWorkspaceDependencies(workspaceType);
  const registrationIntake = {
    ...(candidate.registrationIntake ?? {}),
    ...(tourCapacityMax === null ? {} : { tourCapacityMax }),
  };
  return (ctx: { readonly booking: BookingRecord; readonly occupiedApprovedPartySize: number }) =>
    capacityPolicy.assertCreateCapacity({
      tenantId,
      tourId: ctx.booking.tourId,
      tourTitle: ctx.booking.tourTitle,
      guestLabel: ctx.booking.guestLabel,
      ...(ctx.booking.guestEmail === null ? {} : { guestEmail: ctx.booking.guestEmail }),
      ...(ctx.booking.guestPhone === null ? {} : { guestPhone: ctx.booking.guestPhone }),
      partySize: ctx.booking.partySize,
      departureAt: ctx.booking.departureAt,
      registrationIntake,
      occupiedApprovedPartySize: ctx.occupiedApprovedPartySize,
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
  const candidate = waitlisted[0];
  if (candidate === undefined) {
    return null;
  }

  const assertCapacityInTx = await buildPromotionCapacityAssert(input.tenantId, candidate);
  let approved;
  try {
    approved = await repo.approveWithOutbox({
      bookingId: candidate.id,
      tenantId: input.tenantId,
      outboxEvent: "registration.approved",
      assertCapacityInTx,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("BOOKING_CAPACITY_REJECTED")) {
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
