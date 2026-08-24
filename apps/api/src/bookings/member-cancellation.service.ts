/**
 * DP-4 — member cancellation orchestration (DEN-PROD-09).
 */
import { BOOKING_CANCEL_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";
import { evaluateDenaliMemberCancellationEligibility } from "@app-tour/workspace-denali/host/booking";

import { closePaymentHoldOnOperatorCancel } from "../finance/apply-payment-hold-after-booking-approve.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import { BookingNotFoundError } from "./bookings.errors.ts";
import { getBookingsRepository } from "./create-bookings-repository.ts";
import {
  setBookingPaymentDueAtProjection,
} from "./in-memory-bookings.repository.ts";
import { promoteOldestWaitlistedGuest } from "./promote-waitlist-after-seat-release.ts";
import type { BookingRecord } from "./bookings.types.ts";
import { createMemberCancellationRequest } from "./member-cancellation-request.repository.ts";

export type MemberCancellationEligibilityResponse = {
  readonly eligible: boolean;
  readonly mode: string;
  readonly reasonCode?: string;
};

export type MemberCancellationResult =
  | { readonly kind: "cancelled"; readonly bookingId: string; readonly status: "cancelled" }
  | {
      readonly kind: "request_submitted";
      readonly bookingId: string;
      readonly requestId: string;
      readonly status: string;
    };

function assertMemberOwnsBooking(booking: BookingRecord, auth: BookingActorContext): void {
  if (booking.submittedByUserId !== auth.userId) {
    throw new Error("BOOKING_MEMBER_FORBIDDEN");
  }
}

export function resolveMemberCancellationEligibilityForBooking(
  booking: BookingRecord,
  input: {
    readonly nowIso: string;
    readonly cancellationDeadlineHours?: number | null;
  }
): MemberCancellationEligibilityResponse {
  const eligibility = evaluateDenaliMemberCancellationEligibility({
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    departureAt: booking.departureAt,
    nowIso: input.nowIso,
    paymentDueAt: booking.paymentDueAt ?? null,
    cancellationDeadlineHours: input.cancellationDeadlineHours ?? null,
  });
  return {
    eligible: eligibility.eligible,
    mode: eligibility.mode,
    ...(eligibility.reasonCode !== undefined ? { reasonCode: eligibility.reasonCode } : {}),
  };
}

export async function getMemberCancellationEligibility(
  auth: BookingActorContext,
  bookingId: string,
  cancellationDeadlineHours?: number | null
): Promise<MemberCancellationEligibilityResponse> {
  const repo = getBookingsRepository();
  const booking = await repo.getById(bookingId, auth.tenantId);
  if (booking === null) {
    throw new BookingNotFoundError();
  }
  assertMemberOwnsBooking(booking, auth);
  return resolveMemberCancellationEligibilityForBooking(booking, {
    nowIso: new Date().toISOString(),
    cancellationDeadlineHours,
  });
}

async function executeMemberCancel(
  auth: BookingActorContext,
  booking: BookingRecord
): Promise<MemberCancellationResult> {
  const wasApproved = booking.status === "approved";
  const tourId = booking.tourId;

  await getBookingsRepository().cancelBooking({
    bookingId: booking.id,
    tenantId: auth.tenantId,
    outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
    cancelSource: "member",
  });

  if (wasApproved) {
    await closePaymentHoldOnOperatorCancel({
      tenantId: auth.tenantId,
      bookingId: booking.id,
    });
    setBookingPaymentDueAtProjection({
      tenantId: auth.tenantId,
      bookingId: booking.id,
      paymentDueAt: null,
    });
    await promoteOldestWaitlistedGuest({ tenantId: auth.tenantId, tourId });
  }

  return { kind: "cancelled", bookingId: booking.id, status: "cancelled" };
}

export async function submitMemberCancellation(
  auth: BookingActorContext,
  bookingId: string,
  cancellationDeadlineHours?: number | null
): Promise<MemberCancellationResult> {
  const repo = getBookingsRepository();
  const booking = await repo.getById(bookingId, auth.tenantId);
  if (booking === null) {
    throw new BookingNotFoundError();
  }
  assertMemberOwnsBooking(booking, auth);

  const eligibility = resolveMemberCancellationEligibilityForBooking(booking, {
    nowIso: new Date().toISOString(),
    cancellationDeadlineHours,
  });

  if (!eligibility.eligible) {
    throw new Error(
      `MEMBER_CANCELLATION_DENIED:${eligibility.reasonCode ?? "not_eligible"}`
    );
  }

  if (eligibility.mode === "request") {
    const request = createMemberCancellationRequest({
      tenantId: auth.tenantId,
      bookingId: booking.id,
      requestedByUserId: auth.userId,
    });
    return {
      kind: "request_submitted",
      bookingId: booking.id,
      requestId: request.id,
      status: booking.status,
    };
  }

  return executeMemberCancel(auth, booking);
}
