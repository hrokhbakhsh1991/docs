/**
 * DP-6 — shared post-cancel side effects (capacity, hold, settlement, refund draft).
 */
import { closePaymentHoldOnOperatorCancel } from "../finance/apply-payment-hold-after-booking-approve.ts";
import { orchestrateRefundAfterCancellation } from "../finance/refund-orchestration.service.ts";
import { resolveCancellationPolicyForBooking } from "../finance/resolve-cancellation-policy-for-booking.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import { setBookingPaymentDueAtProjection } from "../bookings/in-memory-bookings.repository.ts";
import { promoteOldestWaitlistedGuest } from "../bookings/promote-waitlist-after-seat-release.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import { handlePassengerCancelledForSettlement } from "../settlement/driver-settlement.service.ts";

export type PostCancelSideEffectsInput = {
  readonly auth: BookingActorContext;
  readonly booking: BookingRecord;
  readonly previousStatus: string;
  readonly cancelDomainEventId: string;
  readonly cancelSource?: string;
  /** Tour-level cancel skips member penalty. */
  readonly tourCancelled?: boolean;
};

export type PostCancelSideEffectsResult = {
  readonly refundDrafted: boolean;
  readonly refundId: string | null;
  readonly eligibleRefundMinor: string;
  readonly waitlistPromoted: boolean;
};

function shouldApplyPenalty(input: {
  readonly previousStatus: string;
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly paymentDueAt: string | null;
  readonly cancellationDeadlineHours: number | null;
  readonly cancellationPenaltyPercentage: number | null;
  readonly tourCancelled: boolean;
}): boolean {
  if (input.tourCancelled || input.paymentStatus === "unpaid") {
    return false;
  }
  if (
    input.cancellationPenaltyPercentage === null ||
    input.cancellationPenaltyPercentage <= 0
  ) {
    return false;
  }
  const nowMs = Date.parse(new Date().toISOString());
  const departureMs = Date.parse(input.departureAt);
  if (
    !Number.isNaN(departureMs) &&
    input.cancellationDeadlineHours !== null &&
    input.cancellationDeadlineHours > 0
  ) {
    const deadlineMs = departureMs - input.cancellationDeadlineHours * 3_600_000;
    if (!Number.isNaN(nowMs) && nowMs >= deadlineMs) {
      return true;
    }
  }
  return false;
}

export async function runPostCancelSideEffects(
  input: PostCancelSideEffectsInput
): Promise<PostCancelSideEffectsResult> {
  const { auth, booking, previousStatus, cancelDomainEventId } = input;
  let waitlistPromoted = false;

  if (previousStatus === "approved") {
    await closePaymentHoldOnOperatorCancel({
      tenantId: auth.tenantId,
      bookingId: booking.id,
    });
    setBookingPaymentDueAtProjection({
      tenantId: auth.tenantId,
      bookingId: booking.id,
      paymentDueAt: null,
    });
    const promoted = await promoteOldestWaitlistedGuest({
      tenantId: auth.tenantId,
      tourId: booking.tourId,
    });
    waitlistPromoted = promoted !== null;
  }

  try {
    await handlePassengerCancelledForSettlement(auth, booking.id);
  } catch {
    // DP-5 optional when transport not configured
  }

  const policy = await resolveCancellationPolicyForBooking({
    tenantId: auth.tenantId,
    bookingId: booking.id,
  });
  const applyPenalty = shouldApplyPenalty({
    previousStatus,
    paymentStatus: booking.paymentStatus,
    departureAt: booking.departureAt,
    paymentDueAt: booking.paymentDueAt ?? null,
    cancellationDeadlineHours: policy.cancellationDeadlineHours,
    cancellationPenaltyPercentage: policy.cancellationPenaltyPercentage,
    tourCancelled: input.tourCancelled === true,
  });

  const refund = await orchestrateRefundAfterCancellation({
    tenantId: auth.tenantId,
    actorUserId: auth.userId,
    registrationId: booking.id,
    cancelDomainEventId,
    applyPenalty,
    cancellationPenaltyPercentage: policy.cancellationPenaltyPercentage,
    reasonCode: input.cancelSource === "member" ? "member_withdrawal" : "ops_correction",
  });

  return {
    refundDrafted: refund.drafted,
    refundId: refund.refundId,
    eligibleRefundMinor: refund.eligibleRefundMinor,
    waitlistPromoted,
  };
}
