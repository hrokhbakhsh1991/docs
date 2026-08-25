/**
 * DP-4 / DP-6 — member cancellation orchestration (DEN-PROD-09).
 * Lives outside `bookings/` so host workspace eligibility can import Denali without
 * violating BK-B1.4 BookingPublicPort neutrality scans.
 */
import { BOOKING_CANCEL_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { buildRefundEligibilitySnapshot } from "../finance/refund-orchestration.service.ts";
import { resolveCancellationPolicyForBooking } from "../finance/resolve-cancellation-policy-for-booking.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import { BookingNotFoundError } from "../bookings/bookings.errors.ts";
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { runPostCancelSideEffects } from "../bookings/post-cancel-side-effects.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import {
  approveMemberCancellationRequest,
  createMemberCancellationRequest,
  findPendingMemberCancellationRequest,
} from "../bookings/member-cancellation-request.repository.ts";
import { evaluateDenaliMemberCancellationEligibility } from "@app-tour/workspace-denali/booking";

export type MemberCancellationEligibilityResponse = {
  readonly eligible: boolean;
  readonly mode: string;
  readonly reasonCode?: string;
  readonly refund?: {
    readonly eligibleRefundMinor: string;
    readonly penaltyMinor: string;
    readonly currency: string;
    readonly hasOpenRefundRequest: boolean;
  };
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
): Omit<MemberCancellationEligibilityResponse, "refund"> {
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
  const policy = await resolveCancellationPolicyForBooking({
    tenantId: auth.tenantId,
    bookingId,
  });
  const hours = cancellationDeadlineHours ?? policy.cancellationDeadlineHours;
  const base = resolveMemberCancellationEligibilityForBooking(booking, {
    nowIso: new Date().toISOString(),
    cancellationDeadlineHours: hours,
  });

  if (booking.paymentStatus === "paid" || booking.paymentStatus === "partial") {
    const refund = await buildRefundEligibilitySnapshot({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      registrationId: bookingId,
      applyPenalty: false,
      cancellationPenaltyPercentage: policy.cancellationPenaltyPercentage,
    });
    return {
      ...base,
      refund: {
        eligibleRefundMinor: refund.eligibleRefundMinor,
        penaltyMinor: refund.penaltyMinor,
        currency: refund.currency,
        hasOpenRefundRequest: refund.hasOpenRefundRequest,
      },
    };
  }

  return base;
}

async function executeMemberCancel(
  auth: BookingActorContext,
  booking: BookingRecord
): Promise<MemberCancellationResult> {
  const previousStatus = booking.status;

  await getBookingsRepository().cancelBooking({
    bookingId: booking.id,
    tenantId: auth.tenantId,
    outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
    cancelSource: "member",
  });

  await runPostCancelSideEffects({
    auth,
    booking: { ...booking, status: "cancelled", cancelSource: "member" },
    previousStatus,
    cancelDomainEventId: `registration.cancelled:${booking.id}`,
    cancelSource: "member",
  });

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

  const policy = await resolveCancellationPolicyForBooking({
    tenantId: auth.tenantId,
    bookingId,
  });
  const eligibility = resolveMemberCancellationEligibilityForBooking(booking, {
    nowIso: new Date().toISOString(),
    cancellationDeadlineHours:
      cancellationDeadlineHours ?? policy.cancellationDeadlineHours,
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

export async function approveMemberCancellationRequestForBooking(
  auth: BookingActorContext,
  bookingId: string
): Promise<MemberCancellationResult> {
  const repo = getBookingsRepository();
  const booking = await repo.getById(bookingId, auth.tenantId);
  if (booking === null) {
    throw new BookingNotFoundError();
  }
  const pending = findPendingMemberCancellationRequest(auth.tenantId, bookingId);
  if (pending === null) {
    throw new Error("MEMBER_CANCELLATION_REQUEST_NOT_FOUND");
  }
  approveMemberCancellationRequest(auth.tenantId, pending.id);
  return executeMemberCancel(auth, booking);
}
