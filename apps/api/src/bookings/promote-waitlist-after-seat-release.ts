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
import type { BookingCapacityTransportFact } from "@app-tour/booking-http-contracts";
import { BookingStatusConflictError } from "./bookings.errors.ts";

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
  return (ctx: {
    readonly booking: BookingRecord;
    readonly occupiedApprovedPartySize: number;
    readonly approvedTransportFacts: readonly BookingCapacityTransportFact[];
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
      registrationIntake,
      occupiedApprovedPartySize: ctx.occupiedApprovedPartySize,
      approvedTransportFacts: ctx.approvedTransportFacts,
      tourCapacityMax,
    });
}

async function listWaitlistedCandidates(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<BookingRecord[]> {
  const repo = getBookingsRepository();
  return (await repo.listByTenant(input.tenantId))
    .filter((row) => row.tourId === input.tourId && row.status === "waitlisted")
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
}

async function tryPromoteCandidate(
  input: { readonly tenantId: string; readonly tourId: string },
  candidate: BookingRecord
): Promise<string | null> {
  const repo = getBookingsRepository();
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
    if (error instanceof BookingStatusConflictError) {
      // Another serialized approval/promotion won this waitlist row after our snapshot.
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

export async function promoteOldestWaitlistedGuest(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<string | null> {
  for (const candidate of await listWaitlistedCandidates(input)) {
    const promotedId = await tryPromoteCandidate(input, candidate);
    if (promotedId !== null) {
      return promotedId;
    }
  }
  return null;
}

/** Re-evaluate an initial waitlist snapshot after any approval that can add capacity. */
export async function promoteAvailableWaitlistedGuests(input: {
  readonly tenantId: string;
  readonly tourId: string;
}): Promise<readonly string[]> {
  const promoted: string[] = [];
  const rows = await getBookingsRepository().listByTenant(input.tenantId);
  const approvedPartySize = rows
    .filter((row) => row.tourId === input.tourId && row.status === "approved")
    .reduce((sum, row) => sum + row.partySize, 0);
  const tourCapacityMax = await new HostBookingTourCapacityAdapter().resolveTourCapacityMax(
    input.tenantId,
    input.tourId
  );
  if (tourCapacityMax !== null && approvedPartySize >= tourCapacityMax) {
    return promoted;
  }

  let occupied = approvedPartySize;
  const waitlisted = rows
    .filter((row) => row.tourId === input.tourId && row.status === "waitlisted")
    .sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
  for (const candidate of waitlisted) {
    if (tourCapacityMax !== null && occupied + candidate.partySize > tourCapacityMax) {
      continue;
    }
    const promotedId = await tryPromoteCandidate(input, candidate);
    if (promotedId !== null) {
      promoted.push(promotedId);
      occupied += candidate.partySize;
    }
  }
  return promoted;
}
