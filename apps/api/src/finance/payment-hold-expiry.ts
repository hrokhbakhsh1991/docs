/**
 * DP1-E/G — expire payment hold and cancel booking with waitlist promotion.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import {
  appendBookingOutboxEventIfAbsent,
  runSerialBookingMutation,
  setBookingPaymentDueAtProjection,
} from "../bookings/in-memory-bookings.repository.ts";
import { applyPaymentHoldAfterBookingApprove } from "./apply-payment-hold-after-booking-approve.ts";
import { isPaymentHoldEnabled, PaymentHoldService } from "./payment-hold.service.ts";

function isPaymentHoldExpiryEnabled(): boolean {
  return process.env.PAYMENT_HOLD_EXPIRY_ENABLED === "true";
}

async function promoteOldestWaitlistedGuest(input: {
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

  const approved = await repo.approveWithOutbox({
    bookingId: candidate.id,
    tenantId: input.tenantId,
    outboxEvent: "registration.approved",
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
  return approved.id;
}

function isExpirableHoldStatus(status: string): boolean {
  return status === "open" || status === "extended";
}

async function expirePaymentHoldForRegistrationImpl(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<{ readonly tenantId: string; readonly tourId: string } | null> {
  const holdService = new PaymentHoldService();
  const hold = await holdService.getByRegistrationId(input.tenantId, input.registrationId);
  if (hold === null || !isExpirableHoldStatus(hold.status)) {
    return null;
  }

  const repo = getBookingsRepository();
  const booking = await repo.getById(input.registrationId, input.tenantId);
  if (booking === null || booking.status !== "approved") {
    if (isExpirableHoldStatus(hold.status) && booking?.paymentStatus === "paid") {
      await holdService.satisfy(input.tenantId, input.registrationId);
    }
    return null;
  }

  if (booking.paymentStatus === "paid") {
    await holdService.satisfy(input.tenantId, input.registrationId);
    return null;
  }

  const expiredAt = new Date().toISOString();
  await holdService.expire(input.tenantId, input.registrationId);

  await repo.cancelBooking({
    bookingId: input.registrationId,
    tenantId: input.tenantId,
    outboxEvent: "registration.cancelled",
    cancelSource: "payment_deadline",
  });

  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.registrationId,
    paymentDueAt: null,
  });

  appendBookingOutboxEventIfAbsent({
    tenantId: input.tenantId,
    aggregateId: input.registrationId,
    eventType: "payment.hold.expired",
    payload: {
      registrationId: input.registrationId,
      holdId: hold.id,
      expiredAt,
      dueAt: hold.dueAt,
    },
    domainEventId: `payment.hold.expired:${hold.id}:${expiredAt}`,
  });

  return { tenantId: input.tenantId, tourId: booking.tourId };
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

  const promoteHint = await runSerialBookingMutation(async () =>
    expirePaymentHoldForRegistrationImpl(input)
  );
  if (promoteHint !== null) {
    await promoteOldestWaitlistedGuest(promoteHint);
  }
}

/** @deprecated Use expirePaymentHoldForRegistration — same serial lock. */
export const expirePaymentHoldForRegistrationLocked = expirePaymentHoldForRegistration;
