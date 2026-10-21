/**
 * DP1-E/G — expire payment hold and cancel booking with waitlist promotion.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import {
  appendBookingOutboxEventIfAbsent,
  runSerialBookingMutation,
  setBookingPaymentDueAtProjection,
} from "../bookings/in-memory-bookings.repository.ts";
import { promoteOldestWaitlistedGuest } from "../bookings/promote-waitlist-after-seat-release.ts";
import { assertDenaliDongSeatReassignment } from "../bookings/assert-denali-dong-seat-reassignment.ts";
import { reconcileDenaliWaitlistAfterCapacityChange } from "../bookings/denali-waitlist-reconciliation.ts";
import { resolveBookingWorkspaceTypeForTenant } from "../bookings/resolve-booking-workspace-type-for-tenant.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import {
  isPaymentHoldEnabled,
  PaymentHoldService,
  type PaymentHoldRecord,
} from "./payment-hold.service.ts";

function isPaymentHoldExpiryEnabled(): boolean {
  return process.env.PAYMENT_HOLD_EXPIRY_ENABLED === "true";
}

function isExpirableHoldStatus(status: string): boolean {
  return status === "open" || status === "extended";
}

async function finishPaymentHoldExpiry(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly hold: PaymentHoldRecord;
  readonly booking: BookingRecord;
  readonly holdService: PaymentHoldService;
}): Promise<void> {
  const expiredAt = new Date().toISOString();
  appendBookingOutboxEventIfAbsent({
    tenantId: input.tenantId,
    aggregateId: input.registrationId,
    eventType: "payment.hold.expired",
    payload: {
      registrationId: input.registrationId,
      holdId: input.hold.id,
      expiredAt,
      dueAt: input.hold.dueAt,
      guestUserId: input.booking.submittedByUserId,
    },
    domainEventId: `payment.hold.expired:${input.hold.id}`,
  });
  if (isExpirableHoldStatus(input.hold.status)) {
    await input.holdService.expire(input.tenantId, input.registrationId);
  }
  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.registrationId,
    paymentDueAt: null,
  });
}

async function expirePaymentHoldForRegistrationImpl(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<{ readonly tenantId: string; readonly tourId: string } | null> {
  const holdService = new PaymentHoldService();
  const hold = await holdService.getByRegistrationId(input.tenantId, input.registrationId);
  if (hold === null) {
    return null;
  }

  const repo = getBookingsRepository();
  const booking = await repo.getById(input.registrationId, input.tenantId);
  if (
    booking?.status === "cancelled" &&
    booking.cancelSource === "payment_deadline" &&
    (isExpirableHoldStatus(hold.status) || hold.status === "expired")
  ) {
    await finishPaymentHoldExpiry({
      ...input,
      hold,
      booking,
      holdService,
    });
    return null;
  }
  if (!isExpirableHoldStatus(hold.status)) {
    return null;
  }
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

  const workspaceType = await resolveBookingWorkspaceTypeForTenant(input.tenantId);
  await repo.cancelBooking({
    bookingId: input.registrationId,
    tenantId: input.tenantId,
    outboxEvent: "registration.cancelled",
    cancelSource: "payment_deadline",
    alreadyWithinSerialMutation: true,
    assertCapacityInTx: (ctx) => {
      if (workspaceType === "denali") {
        assertDenaliDongSeatReassignment(ctx);
      }
    },
  });
  await finishPaymentHoldExpiry({
    ...input,
    hold,
    booking,
    holdService,
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
    const workspaceType = await resolveBookingWorkspaceTypeForTenant(promoteHint.tenantId);
    if (workspaceType === "denali") {
      await reconcileDenaliWaitlistAfterCapacityChange(promoteHint);
    } else {
      await promoteOldestWaitlistedGuest(promoteHint);
    }
  }
}

/** @deprecated Use expirePaymentHoldForRegistration — same serial lock. */
export const expirePaymentHoldForRegistrationLocked = expirePaymentHoldForRegistration;
