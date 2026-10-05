/**
 * DP-4 / DP-6 — member cancellation orchestration (DEN-PROD-09).
 * Lives outside `bookings/` so host workspace eligibility can import Denali without
 * violating BK-B1.4 BookingPublicPort neutrality scans.
 */
import {
  BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
  type CancelBookingResponse,
} from "@app-tour/booking-http-contracts";

import { buildRefundEligibilitySnapshot } from "../finance/refund-orchestration.service.ts";
import { resolveCancellationPolicyForBooking } from "../finance/resolve-cancellation-policy-for-booking.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import { BookingNotFoundError } from "../bookings/bookings.errors.ts";
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { HostBookingAuthorizationAdapter } from "../bookings/infrastructure/host-booking-authorization.adapter.ts";
import { runPostCancelSideEffects } from "../bookings/post-cancel-side-effects.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import { evaluateDenaliMemberCancellationEligibility } from "@app-tour/workspace-denali/booking";

const bookingAuthorization = new HostBookingAuthorizationAdapter();

export type MemberCancellationEligibilityResponse = {
  readonly eligible: boolean;
  readonly mode: string;
  readonly reasonCode?: string;
  readonly request?: {
    readonly status: "pending" | "rejected";
    readonly requestedAt: string | null;
    readonly rejectedAt: string | null;
    readonly reasonNote: string | null;
  };
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
      readonly cancellationStatus: NonNullable<BookingRecord["cancellationStatus"]>;
      readonly refundStatus: NonNullable<CancelBookingResponse["refundStatus"]>;
      readonly settlementStatus: NonNullable<CancelBookingResponse["settlementStatus"]>;
      readonly notificationStatus: NonNullable<CancelBookingResponse["notificationStatus"]>;
    }
  | {
      readonly kind: "request_submitted";
      readonly bookingId: string;
      readonly requestId: string;
      readonly status: string;
    }
  | {
      readonly kind: "request_rejected";
      readonly bookingId: string;
      readonly status: "rejected";
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
  if (booking.cancellationStatus === "request_pending") {
    return { eligible: false, mode: "request_pending", reasonCode: "request_pending" };
  }
  if (booking.cancellationStatus === "rejected") {
    return { eligible: false, mode: "request_rejected", reasonCode: "request_rejected" };
  }
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
  const request =
    booking.cancellationStatus === "request_pending" || booking.cancellationStatus === "rejected"
      ? {
          status:
            booking.cancellationStatus === "request_pending"
              ? ("pending" as const)
              : ("rejected" as const),
          requestedAt: booking.cancellationRequestedAt ?? null,
          rejectedAt: booking.cancellationRejectedAt ?? null,
          reasonNote: booking.cancellationReasonNote ?? null,
        }
      : undefined;

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
      ...(request !== undefined ? { request } : {}),
      refund: {
        eligibleRefundMinor: refund.eligibleRefundMinor,
        penaltyMinor: refund.penaltyMinor,
        currency: refund.currency,
        hasOpenRefundRequest: refund.hasOpenRefundRequest,
      },
    };
  }

  return { ...base, ...(request !== undefined ? { request } : {}) };
}

async function executeMemberCancel(
  auth: BookingActorContext,
  booking: BookingRecord,
  repository = getBookingsRepository()
): Promise<MemberCancellationResult> {
  const correlationId = `registration.cancelled:${booking.id}`;
  const recoveringPreviousAttempt =
    booking.status === "cancelled" &&
    booking.cancelSource === "member" &&
    booking.cancellationCorrelationId === correlationId;
  const previousStatus = recoveringPreviousAttempt
    ? (booking.cancellationPreviousStatus ?? "approved")
    : booking.status;

  const cancelledBooking = recoveringPreviousAttempt
    ? booking
    : await repository.cancelBooking({
        bookingId: booking.id,
        tenantId: auth.tenantId,
        outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
        cancelSource: "member",
        cancellationStatus:
          Date.parse(booking.departureAt) <= Date.now() ? "late_correction" : "applied",
        cancellationReasonCode: "member_withdrawal",
        cancellationApprovedByUserId: auth.userId,
        cancellationCorrelationId: correlationId,
        ...(booking.cancellationStatus === "request_pending"
          ? { expectedCancellationStatus: "request_pending" as const }
          : {}),
      });

  let settlementStatus: NonNullable<CancelBookingResponse["settlementStatus"]> = "not_affected";
  let notificationStatus: NonNullable<CancelBookingResponse["notificationStatus"]> =
    "manual_review";
  let refundStatus: NonNullable<CancelBookingResponse["refundStatus"]> =
    booking.paymentStatus === "paid" || booking.paymentStatus === "partial"
      ? "manual_review"
      : "not_required";
  try {
    const effects = await runPostCancelSideEffects({
      auth,
      booking: {
        ...booking,
        ...cancelledBooking,
        status: "cancelled",
        cancelSource: "member",
      },
      previousStatus,
      cancelDomainEventId: correlationId,
      cancelSource: "member",
      repository,
    });
    settlementStatus = effects.settlementStatus;
    notificationStatus = effects.notificationStatus;
    refundStatus = effects.refundStatus;
  } catch {
    settlementStatus = "manual_review";
    notificationStatus = "manual_review";
  }

  const checkpointed = await repository.getById(booking.id, auth.tenantId);
  return {
    kind: "cancelled",
    bookingId: booking.id,
    status: "cancelled",
    cancellationStatus: checkpointed?.cancellationStatus ?? "manual_review",
    refundStatus,
    settlementStatus,
    notificationStatus,
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
  const correlationId = `registration.cancelled:${booking.id}`;
  const recoveringPreviousAttempt =
    booking.status === "cancelled" &&
    booking.cancelSource === "member" &&
    booking.cancellationCorrelationId === correlationId;
  if (recoveringPreviousAttempt) {
    return executeMemberCancel(auth, booking, repo);
  }
  if (booking.cancellationStatus === "request_pending") {
    const pendingCorrelationId = booking.cancellationCorrelationId ?? correlationId;
    return {
      kind: "request_submitted",
      bookingId: booking.id,
      requestId: pendingCorrelationId,
      status: booking.status,
    };
  }

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
    const request = await repo.requestMemberCancellation({
      tenantId: auth.tenantId,
      bookingId: booking.id,
      requestedByUserId: auth.userId,
      correlationId,
    });
    return {
      kind: "request_submitted",
      bookingId: booking.id,
      requestId: request.cancellationCorrelationId ?? correlationId,
      status: booking.status,
    };
  }

  return executeMemberCancel(auth, booking, repo);
}

export async function approveMemberCancellationRequestForBooking(
  auth: BookingActorContext,
  bookingId: string
): Promise<MemberCancellationResult> {
  bookingAuthorization.assertOpsAccess(auth);
  const repo = getBookingsRepository();
  const booking = await repo.getById(bookingId, auth.tenantId);
  if (booking === null) {
    throw new BookingNotFoundError();
  }
  const correlationId = `registration.cancelled:${booking.id}`;
  const recoveringPreviousAttempt =
    booking.status === "cancelled" &&
    booking.cancelSource === "member" &&
    booking.cancellationCorrelationId === correlationId;
  if (booking.cancellationStatus !== "request_pending" && !recoveringPreviousAttempt) {
    throw new Error("MEMBER_CANCELLATION_REQUEST_NOT_FOUND");
  }
  return executeMemberCancel(auth, booking, repo);
}

export async function rejectMemberCancellationRequestForBooking(
  auth: BookingActorContext,
  bookingId: string,
  reasonNote?: string
): Promise<MemberCancellationResult> {
  bookingAuthorization.assertOpsAccess(auth);
  const repo = getBookingsRepository();
  const booking = await repo.getById(bookingId, auth.tenantId);
  if (booking === null) {
    throw new BookingNotFoundError();
  }
  if (booking.cancellationStatus === "rejected") {
    return { kind: "request_rejected", bookingId, status: "rejected" };
  }
  if (booking.cancellationStatus !== "request_pending") {
    throw new Error("MEMBER_CANCELLATION_REQUEST_NOT_FOUND");
  }
  const normalizedReason = reasonNote?.trim();
  if (normalizedReason === undefined || normalizedReason.length === 0) {
    throw new Error("MEMBER_CANCELLATION_REJECT_REASON_REQUIRED");
  }
  await repo.rejectMemberCancellation({
    bookingId,
    tenantId: auth.tenantId,
    rejectedByUserId: auth.userId,
    reasonNote: normalizedReason,
  });
  return { kind: "request_rejected", bookingId, status: "rejected" };
}
