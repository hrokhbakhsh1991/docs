/**
 * DP-6 — shared post-cancel side effects (capacity, hold, settlement, refund draft).
 */
import { closePaymentHoldOnOperatorCancel } from "../finance/apply-payment-hold-after-booking-approve.ts";
import { orchestrateRefundAfterCancellation } from "../finance/refund-orchestration.service.ts";
import { resolveCancellationPolicyForBooking } from "../finance/resolve-cancellation-policy-for-booking.ts";
import type { BookingActorContext } from "../bookings/ports/booking-actor-context.ts";
import type { BookingRepositoryPort } from "../bookings/ports/booking-repository.port.ts";
import { setBookingPaymentDueAtProjection } from "../bookings/in-memory-bookings.repository.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import {
  handleDriverCancelledForSettlement,
  handlePassengerCancelledForSettlement,
} from "../settlement/driver-settlement.service.ts";
import { listTransportAllocations } from "../transport/transport-allocation.repository.ts";

export type PostCancelSideEffectsInput = {
  readonly auth: BookingActorContext;
  readonly booking: BookingRecord;
  readonly previousStatus: string;
  readonly cancelDomainEventId: string;
  readonly cancelSource?: string;
  /** Tour-level cancel skips member penalty. */
  readonly tourCancelled?: boolean;
  /** Payment-deadline expiry owns the open-to-expired hold transition itself. */
  readonly skipPaymentHoldClose?: boolean;
  /** Keep notification reads/writes on the lifecycle command repository. */
  readonly repository?: Pick<
    BookingRepositoryPort,
    "getById" | "appendOutboxEventIfAbsent" | "recordCancellationEffect"
  >;
};

export type PostCancelSideEffectsResult = {
  readonly refundDrafted: boolean;
  readonly refundId: string | null;
  readonly eligibleRefundMinor: string;
  readonly refundStatus:
    | "not_required"
    | "pending_finance_approval"
    | "completed"
    | "manual_review";
  readonly waitlistPromoted: boolean;
  readonly waitlistCandidate: boolean;
  readonly settlementStatus: "not_affected" | "correction_pending" | "manual_review";
  readonly notificationStatus: "queued" | "manual_review";
};

export function shouldApplyPenalty(input: {
  readonly paymentStatus: string;
  readonly departureAt: string;
  readonly cancellationAt: string | null | undefined;
  readonly cancellationDeadlineHours: number | null;
  readonly cancellationPenaltyPercentage: number | null;
  readonly tourCancelled: boolean;
}): boolean {
  if (input.tourCancelled || input.paymentStatus === "unpaid") {
    return false;
  }
  if (input.cancellationPenaltyPercentage === null || input.cancellationPenaltyPercentage <= 0) {
    return false;
  }
  if (input.cancellationDeadlineHours === null || input.cancellationDeadlineHours <= 0) {
    return false;
  }
  const cancellationAtMs = Date.parse(input.cancellationAt ?? "");
  const departureMs = Date.parse(input.departureAt);
  if (!Number.isFinite(cancellationAtMs) || !Number.isFinite(departureMs)) {
    throw new Error("CANCELLATION_FINANCIAL_TIMESTAMP_INVALID");
  }
  const deadlineMs = departureMs - input.cancellationDeadlineHours * 3_600_000;
  return cancellationAtMs >= deadlineMs;
}

export function shouldQueueWaitlistReview(input: {
  readonly previousStatus: string;
  readonly departureAt: string;
  readonly cancellationApprovedAt: string | null | undefined;
  readonly persistedStatus:
    | "pending"
    | "completed"
    | "not_required"
    | "manual_review"
    | null
    | undefined;
}): boolean {
  if (input.previousStatus !== "approved") {
    return false;
  }
  if (input.persistedStatus === "pending" || input.persistedStatus === "manual_review") {
    return true;
  }
  if (input.persistedStatus === "completed" || input.persistedStatus === "not_required") {
    return false;
  }
  const cancellationAtMs = Date.parse(input.cancellationApprovedAt ?? "");
  const departureAtMs = Date.parse(input.departureAt);
  if (!Number.isFinite(cancellationAtMs) || !Number.isFinite(departureAtMs)) {
    return true;
  }
  return departureAtMs > cancellationAtMs;
}

export async function runPostCancelSideEffects(
  input: PostCancelSideEffectsInput
): Promise<PostCancelSideEffectsResult> {
  const { auth, booking, previousStatus, cancelDomainEventId } = input;
  let waitlistPromoted = false;
  const waitlistCandidate = shouldQueueWaitlistReview({
    previousStatus,
    departureAt: booking.departureAt,
    cancellationApprovedAt: booking.cancellationApprovedAt,
    persistedStatus: booking.cancellationWork?.waitlistReview,
  });
  let settlementStatus: PostCancelSideEffectsResult["settlementStatus"] = "not_affected";
  let notificationStatus: PostCancelSideEffectsResult["notificationStatus"] =
    booking.submittedByUserId.trim().length > 0 ? "queued" : "manual_review";
  const repository = input.repository ?? getBookingsRepository();
  const recordEffect = (
    effect: Parameters<BookingRepositoryPort["recordCancellationEffect"]>[0]["effect"],
    status: Parameters<BookingRepositoryPort["recordCancellationEffect"]>[0]["status"],
    transportImpact?: Parameters<
      BookingRepositoryPort["recordCancellationEffect"]
    >[0]["transportImpact"]
  ) =>
    repository.recordCancellationEffect({
      bookingId: booking.id,
      tenantId: auth.tenantId,
      correlationId: cancelDomainEventId,
      effect,
      status,
      ...(transportImpact !== undefined ? { transportImpact } : {}),
    });
  const liveAffectedDriverRegistrationIds = [
    ...new Set(
      listTransportAllocations(auth.tenantId, booking.tourId)
        .filter((allocation) => allocation.passengerRegistrationId === booking.id)
        .map((allocation) => allocation.driverRegistrationId)
    ),
  ];
  const liveAffectedPassengerRegistrationIds = [
    ...new Set(
      listTransportAllocations(auth.tenantId, booking.tourId)
        .filter((allocation) => allocation.driverRegistrationId === booking.id)
        .map((allocation) => allocation.passengerRegistrationId)
    ),
  ];
  const affectedDriverRegistrationIds = [
    ...new Set([
      ...(booking.cancellationTransportImpact?.affectedDriverRegistrationIds ?? []),
      ...liveAffectedDriverRegistrationIds,
    ]),
  ];
  const affectedPassengerRegistrationIds = [
    ...new Set([
      ...(booking.cancellationTransportImpact?.affectedPassengerRegistrationIds ?? []),
      ...liveAffectedPassengerRegistrationIds,
    ]),
  ];

  await recordEffect("notification", "pending", {
    affectedDriverRegistrationIds,
    affectedPassengerRegistrationIds,
  });

  await recordEffect("waitlistReview", waitlistCandidate ? "pending" : "not_required");

  if (previousStatus === "approved") {
    let paymentHoldStatus: "completed" | "manual_review" = "completed";
    try {
      if (input.skipPaymentHoldClose !== true) {
        await closePaymentHoldOnOperatorCancel({
          tenantId: auth.tenantId,
          bookingId: booking.id,
        });
      }
      setBookingPaymentDueAtProjection({
        tenantId: auth.tenantId,
        bookingId: booking.id,
        paymentDueAt: null,
      });
    } catch {
      paymentHoldStatus = "manual_review";
    }
    await recordEffect("paymentHold", paymentHoldStatus);
  } else {
    await recordEffect("paymentHold", "not_required");
  }

  for (const driverRegistrationId of affectedDriverRegistrationIds) {
    try {
      const driverBooking = await repository.getById(driverRegistrationId, auth.tenantId);
      if (driverBooking === null || driverBooking.submittedByUserId.trim().length === 0) {
        notificationStatus = "manual_review";
        continue;
      }
      await repository.appendOutboxEventIfAbsent({
        tenantId: auth.tenantId,
        aggregateId: driverRegistrationId,
        eventType: "registration.passenger_cancelled",
        payload: {
          guestUserId: driverBooking.submittedByUserId,
          driverRegistrationId,
          passengerRegistrationId: booking.id,
          tourId: booking.tourId,
          source: input.cancelSource ?? "operator",
        },
        domainEventId: `${cancelDomainEventId}:driver:${driverRegistrationId}`,
        correlationId: cancelDomainEventId,
      });
    } catch {
      notificationStatus = "manual_review";
    }
  }
  for (const passengerRegistrationId of affectedPassengerRegistrationIds) {
    try {
      const passengerBooking = await repository.getById(passengerRegistrationId, auth.tenantId);
      if (passengerBooking === null || passengerBooking.submittedByUserId.trim().length === 0) {
        notificationStatus = "manual_review";
        continue;
      }
      await repository.appendOutboxEventIfAbsent({
        tenantId: auth.tenantId,
        aggregateId: passengerRegistrationId,
        eventType: "registration.driver_cancelled",
        payload: {
          guestUserId: passengerBooking.submittedByUserId,
          driverRegistrationId: booking.id,
          passengerRegistrationId,
          tourId: booking.tourId,
          source: input.cancelSource ?? "operator",
        },
        domainEventId: `${cancelDomainEventId}:passenger:${passengerRegistrationId}`,
        correlationId: cancelDomainEventId,
      });
    } catch {
      notificationStatus = "manual_review";
    }
  }
  await recordEffect(
    "notification",
    notificationStatus === "manual_review" ? "manual_review" : "completed"
  );

  try {
    await handlePassengerCancelledForSettlement(auth, booking.id);
    settlementStatus = await handleDriverCancelledForSettlement(auth, booking.tourId, booking.id);
  } catch {
    settlementStatus = "manual_review";
  }
  await recordEffect(
    "transportSettlement",
    settlementStatus === "manual_review" || settlementStatus === "correction_pending"
      ? "manual_review"
      : "completed"
  );

  let refundDrafted = false;
  let refundId: string | null = null;
  let eligibleRefundMinor = "0";
  let refundStatus: PostCancelSideEffectsResult["refundStatus"] = "manual_review";
  try {
    const policy = await resolveCancellationPolicyForBooking({
      tenantId: auth.tenantId,
      bookingId: booking.id,
    });
    const cancellationAt = booking.cancellationApprovedAt;
    const cancellationAtMs = Date.parse(cancellationAt ?? "");
    const departureAtMs = Date.parse(booking.departureAt);
    const isLateCorrection =
      booking.cancellationStatus === "late_correction" ||
      (Number.isFinite(cancellationAtMs) &&
        Number.isFinite(departureAtMs) &&
        departureAtMs <= cancellationAtMs);
    const applyPenalty = isLateCorrection
      ? false
      : shouldApplyPenalty({
          paymentStatus: booking.paymentStatus,
          departureAt: booking.departureAt,
          cancellationAt,
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
      projectedPaymentStatus: booking.paymentStatus,
      reasonCode: isLateCorrection
        ? "ops_correction"
        : input.cancelSource === "member"
          ? "member_withdrawal"
          : "ops_correction",
    });
    refundDrafted = refund.drafted;
    refundId = refund.refundId;
    eligibleRefundMinor = refund.eligibleRefundMinor;
    refundStatus = refund.refundStatus;
    await recordEffect(
      "refund",
      refund.refundStatus === "manual_review"
        ? "manual_review"
        : refund.refundStatus === "not_required"
          ? "not_required"
          : "completed"
    );
  } catch {
    await recordEffect("refund", "manual_review");
  }

  return {
    refundDrafted,
    refundId,
    eligibleRefundMinor,
    refundStatus,
    waitlistPromoted,
    waitlistCandidate,
    settlementStatus,
    notificationStatus,
  };
}
