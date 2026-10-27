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
import { resolveBookingsServiceForTenant } from "../bookings/create-bookings-service.ts";
import { runPostCancelSideEffects } from "../bookings/post-cancel-side-effects.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import { evaluateDenaliMemberCancellationEligibility } from "@app-tour/workspace-denali/booking";

export type MemberCancellationEligibilityResponse = {
  readonly eligible: boolean;
  readonly mode: string;
  readonly reasonCode?: string;
  readonly cancellationStatus?: BookingRecord["cancellationStatus"];
  readonly cancellationRequestedAt?: string | null;
  readonly refund?: {
    readonly eligibleRefundMinor: string;
    readonly penaltyMinor: string;
    readonly currency: string;
    readonly hasOpenRefundRequest: boolean;
  };
};

export type MemberCancellationResult =
  | {
      readonly kind: "cancelled";
      readonly bookingId: string;
      readonly status: "cancelled";
      readonly refundStatus: "not_required" | "pending_finance_approval";
      readonly settlementStatus: "not_affected" | "correction_pending" | "manual_review";
    }
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
  const state = {
    cancellationStatus: booking.cancellationStatus ?? ("none" as const),
    cancellationRequestedAt: booking.cancellationRequestedAt ?? null,
  };

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
      ...state,
      refund: {
        eligibleRefundMinor: refund.eligibleRefundMinor,
        penaltyMinor: refund.penaltyMinor,
        currency: refund.currency,
        hasOpenRefundRequest: refund.hasOpenRefundRequest,
      },
    };
  }

  return { ...base, ...state };
}

async function executeMemberCancel(
  auth: BookingActorContext,
  booking: BookingRecord,
  requirePendingRequest = false
): Promise<MemberCancellationResult> {
  const previousStatus = booking.status;
  const bookingsService = await resolveBookingsServiceForTenant(auth.tenantId);

  await getBookingsRepository().cancelBooking({
    bookingId: booking.id,
    tenantId: auth.tenantId,
    outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
    cancelSource: "member",
    cancellationStatus:
      Date.parse(booking.departureAt) <= Date.now() ? "late_correction" : "applied",
    ...(requirePendingRequest ? { expectedCancellationStatus: "request_pending" as const } : {}),
    cancellationReasonCode: "member_withdrawal",
    cancellationApprovedByUserId: auth.userId,
    cancellationCorrelationId: `registration.cancelled:${booking.id}`,
    assertCapacityAfterRemovalInTx: await bookingsService.createCapacityReleaseAssertion(
      auth.tenantId
    ),
  });

  const refundStatus =
    booking.paymentStatus === "paid" || booking.paymentStatus === "partial"
      ? "pending_finance_approval"
      : "not_required";
  let settlementStatus: "not_affected" | "correction_pending" | "manual_review" = "not_affected";
  try {
    const effects = await runPostCancelSideEffects({
      auth,
      booking: { ...booking, status: "cancelled", cancelSource: "member" },
      previousStatus,
      cancelDomainEventId: `registration.cancelled:${booking.id}`,
      cancelSource: "member",
    });
    settlementStatus = effects.settlementStatus;
  } catch {
    // The lifecycle transition is already persisted. Never turn a successful
    // cancellation into a retry-shaped 500 when Finance/settlement needs review.
    settlementStatus = "manual_review";
  }
  await bookingsService.recheckWaitlistAfterCapacityChangeForTenant({
    tenantId: auth.tenantId,
    tourId: booking.tourId,
  });

  return {
    kind: "cancelled",
    bookingId: booking.id,
    status: "cancelled",
    refundStatus,
    settlementStatus,
  };
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
    cancellationDeadlineHours: cancellationDeadlineHours ?? policy.cancellationDeadlineHours,
  });

  if (!eligibility.eligible) {
    throw new Error(`MEMBER_CANCELLATION_DENIED:${eligibility.reasonCode ?? "not_eligible"}`);
  }

  if (eligibility.mode === "request") {
    const requested = await repo.requestMemberCancellation({
      bookingId: booking.id,
      tenantId: auth.tenantId,
      requestedByUserId: auth.userId,
    });
    return {
      kind: "request_submitted",
      bookingId: booking.id,
      requestId: `${booking.id}:${requested.cancellationRequestedAt ?? "pending"}`,
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
  if (booking.cancellationStatus !== "request_pending") {
    throw new Error("MEMBER_CANCELLATION_REQUEST_NOT_FOUND");
  }
  return executeMemberCancel(auth, booking, true);
}

export async function rejectMemberCancellationRequestForBooking(
  auth: BookingActorContext,
  bookingId: string,
  reasonNote?: string
): Promise<{ readonly bookingId: string; readonly cancellationStatus: "rejected" }> {
  const booking = await getBookingsRepository().rejectMemberCancellationRequest({
    bookingId,
    tenantId: auth.tenantId,
    rejectedByUserId: auth.userId,
    ...(reasonNote !== undefined ? { reasonNote } : {}),
  });
  return { bookingId: booking.id, cancellationStatus: "rejected" };
}

export async function listPendingMemberCancellationRequests(auth: BookingActorContext): Promise<{
  readonly items: readonly {
    readonly id: string;
    readonly guestLabel: string;
    readonly tourTitle: string;
    readonly cancellationStatus: BookingRecord["cancellationStatus"];
    readonly cancellationRequestedAt?: string | null;
  }[];
}> {
  const page = await getBookingsRepository().listByTenantPage({
    tenantId: auth.tenantId,
    cancellationStatus: "request_pending",
    limit: 100,
  });
  return {
    items: page.items.map(
      ({ id, guestLabel, tourTitle, cancellationStatus, cancellationRequestedAt }) => ({
        id,
        guestLabel,
        tourTitle,
        cancellationStatus,
        cancellationRequestedAt,
      })
    ),
  };
}
