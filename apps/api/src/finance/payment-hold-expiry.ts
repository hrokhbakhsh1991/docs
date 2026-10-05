/**
 * DP1-E/G — expire payment hold through the shared cancellation workflow.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import {
  runSerialBookingMutation,
  setBookingPaymentDueAtProjection,
} from "../bookings/in-memory-bookings.repository.ts";
import { runPostCancelSideEffects } from "../bookings/post-cancel-side-effects.ts";
import { isPaymentHoldEnabled, PaymentHoldService } from "./payment-hold.service.ts";

function isPaymentHoldExpiryEnabled(): boolean {
  return process.env.PAYMENT_HOLD_EXPIRY_ENABLED === "true";
}

function isExpirableHoldStatus(status: string): boolean {
  return status === "open" || status === "extended";
}

async function expirePaymentHoldForRegistrationImpl(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<void> {
  const holdService = new PaymentHoldService();
  const hold = await holdService.getByRegistrationId(input.tenantId, input.registrationId);
  if (hold === null || (!isExpirableHoldStatus(hold.status) && hold.status !== "expired")) {
    return;
  }

  const repo = getBookingsRepository();
  const booking = await repo.getById(input.registrationId, input.tenantId);
  if (booking === null) {
    return;
  }
  const correlationId = `payment.hold.expired:${hold.id}`;
  const recoveringCancellation =
    booking.status === "cancelled" &&
    booking.cancelSource === "payment_deadline" &&
    booking.cancellationCorrelationId === correlationId;

  if (booking.status !== "approved" && !recoveringCancellation) {
    if (isExpirableHoldStatus(hold.status) && booking?.paymentStatus === "paid") {
      await holdService.satisfy(input.tenantId, input.registrationId);
    }
    return;
  }

  if (!recoveringCancellation && booking.paymentStatus === "paid") {
    await holdService.satisfy(input.tenantId, input.registrationId);
    return;
  }

  const expiredAt = new Date().toISOString();
  const cancelledBooking = recoveringCancellation
    ? booking
    : await repo.cancelBooking({
        bookingId: input.registrationId,
        tenantId: input.tenantId,
        outboxEvent: "registration.cancelled",
        cancelSource: "payment_deadline",
        cancellationStatus: "applied",
        cancellationReasonCode: "payment_deadline_expired",
        // Automated expiry has no human UUID approver. System provenance is
        // carried by cancelSource + the stable hold correlation id.
        cancellationCorrelationId: correlationId,
      });

  // This entry point owns the open/extended -> expired transition. Complete it
  // before the shared workflow checkpoints paymentHold as completed.
  if (isExpirableHoldStatus(hold.status)) {
    await holdService.expire(input.tenantId, input.registrationId);
  }

  await runPostCancelSideEffects({
    auth: {
      tenantId: input.tenantId,
      userId: "system:payment-hold-expiry",
      role: "admin",
      status: "ACTIVE",
    },
    booking: {
      ...booking,
      ...cancelledBooking,
      status: "cancelled",
      cancelSource: "payment_deadline",
    },
    previousStatus: "approved",
    cancelDomainEventId: correlationId,
    cancelSource: "payment_deadline",
    skipPaymentHoldClose: true,
    repository: repo,
  });

  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.registrationId,
    paymentDueAt: null,
  });

  await repo.appendOutboxEventIfAbsent({
    tenantId: input.tenantId,
    aggregateId: input.registrationId,
    eventType: "payment.hold.expired",
    payload: {
      registrationId: input.registrationId,
      holdId: hold.id,
      expiredAt,
      dueAt: hold.dueAt,
      guestUserId: booking.submittedByUserId,
    },
    // The registration.cancelled outbox row already owns correlationId.
    // Give the distinct hold event its own stable identity so aggregate-level
    // deduplication does not suppress it, while retries still remain idempotent.
    domainEventId: `${correlationId}:hold-event`,
  });
}

/** Expire hold inside an existing serial booking lock (no nested lock; no waitlist promote). */
export async function expirePaymentHoldForRegistrationWithinLock(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<void> {
  if (!isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return;
  }
  await expirePaymentHoldForRegistrationImpl(input);
}

export async function expirePaymentHoldForRegistration(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<void> {
  if (!isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return;
  }

  await runSerialBookingMutation(async () => expirePaymentHoldForRegistrationImpl(input));
}

/** @deprecated Use expirePaymentHoldForRegistration — same serial lock. */
export const expirePaymentHoldForRegistrationLocked = expirePaymentHoldForRegistration;
