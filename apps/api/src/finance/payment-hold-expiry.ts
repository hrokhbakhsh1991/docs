/**
 * DP1-E/G — expire payment hold and cancel booking with waitlist promotion.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import { PaymentDeadlinePaymentAlreadySettledError } from "../bookings/bookings.errors.ts";
import type { BookingRecord } from "../bookings/bookings.types.ts";
import {
  appendBookingOutboxEventIfAbsent,
  listDriverHoldExpiryWaitlistedBookingIds,
  runSerialBookingMutation,
  setBookingPaymentDueAtProjection,
} from "../bookings/in-memory-bookings.repository.ts";
import { promoteOldestWaitlistedGuest } from "../bookings/promote-waitlist-after-seat-release.ts";
import { resolveBookingsServiceForTenant } from "../bookings/create-bookings-service.ts";
import { isPaymentHoldEnabled, PaymentHoldService } from "./payment-hold.service.ts";
import { resolveStorageDriver } from "../storage/production-storage-driver-assert.ts";
import {
  listTransportAllocations,
  removeAllocationsForDriver,
  removeAllocationsForPassenger,
} from "../transport/transport-allocation.repository.ts";

function isPaymentHoldExpiryEnabled(): boolean {
  return process.env.PAYMENT_HOLD_EXPIRY_ENABLED === "true";
}

function isExpirableHoldStatus(status: string): boolean {
  return status === "open" || status === "extended";
}

async function expirePaymentHoldForRegistrationImpl(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<
  | { readonly status: "expired"; readonly tenantId: string; readonly tourId: string }
  | { readonly status: "deferred"; readonly tenantId: string; readonly tourId: string }
  | null
> {
  const holdService = new PaymentHoldService();
  const hold = await holdService.getByRegistrationId(input.tenantId, input.registrationId);
  if (hold === null) {
    return null;
  }

  const repo = getBookingsRepository();
  const booking = await repo.getById(input.registrationId, input.tenantId);
  if (booking === null) {
    return null;
  }
  const wasExpiredBooking =
    booking.status === "cancelled" && booking.cancelSource === "payment_deadline";
  if (!isExpirableHoldStatus(hold.status) && !wasExpiredBooking) {
    return null;
  }
  if (booking.status !== "approved" && !wasExpiredBooking) {
    if (isExpirableHoldStatus(hold.status) && booking?.paymentStatus === "paid") {
      await holdService.satisfy(input.tenantId, input.registrationId);
    }
    return null;
  }

  if (booking.paymentStatus === "paid") {
    await holdService.satisfy(input.tenantId, input.registrationId);
    return null;
  }

  if (booking.transportKind === "personal_car") {
    const prisma = resolveStorageDriver() === "prisma";
    let passengers: readonly BookingRecord[] = [];
    let driverExpiryDeferred = false;
    if (!wasExpiredBooking) {
      const knownDependentBookingIds = prisma
        ? undefined
        : listTransportAllocations(input.tenantId, booking.tourId)
            .filter((allocation) => allocation.driverRegistrationId === booking.id)
            .map((allocation) => allocation.passengerRegistrationId);
      const bookingsService = await resolveBookingsServiceForTenant(input.tenantId);
      const expiry = await repo.expireDriverHoldWithUnpaidPassengers({
        tenantId: input.tenantId,
        tourId: booking.tourId,
        driverBookingId: booking.id,
        driverHoldId: hold.id,
        expectedDueAt: hold.dueAt,
        serialBookingMutationAlreadyHeld: true,
        ...(knownDependentBookingIds !== undefined ? { knownDependentBookingIds } : {}),
        ...(!prisma
          ? {
              assertDriverHoldStillCurrent: async () => {
                const latestHold = await holdService.getByRegistrationId(
                  input.tenantId,
                  input.registrationId
                );
                return (
                  latestHold !== null &&
                  latestHold.id === hold.id &&
                  isExpirableHoldStatus(latestHold.status) &&
                  latestHold.dueAt === hold.dueAt
                );
              },
            }
          : {}),
        assertCapacityAfterRemovalInTx: await bookingsService.createCapacityReleaseAssertion(
          input.tenantId
        ),
      });
      if (expiry === null) return null;
      passengers = expiry.passengers;
      driverExpiryDeferred = expiry.status === "deferred";
    } else if (!prisma) {
      // The booking/outbox transition may have committed before an external
      // hold update failed. Rebuild the passenger set from its deterministic
      // lifecycle event so the next scheduler tick can finish the workflow.
      const passengerIds = listDriverHoldExpiryWaitlistedBookingIds({
        tenantId: input.tenantId,
        driverHoldId: hold.id,
        dueAt: hold.dueAt,
      });
      const recovered = await Promise.all(
        passengerIds.map((id) => repo.getById(id, input.tenantId))
      );
      passengers = recovered.filter(
        (row): row is BookingRecord =>
          row !== null &&
          row.tourId === booking.tourId &&
          row.status === "waitlisted" &&
          row.paymentStatus === "unpaid"
      );
    }

    const expiredAt = new Date().toISOString();
    for (const passenger of passengers) {
      const passengerHold = await holdService.getByRegistrationId(input.tenantId, passenger.id);
      if (passengerHold !== null && isExpirableHoldStatus(passengerHold.status)) {
        await holdService.expire(input.tenantId, passenger.id);
      }
      const resultingHold = await holdService.getByRegistrationId(input.tenantId, passenger.id);
      if (!prisma && resultingHold?.status === "expired") {
        appendBookingOutboxEventIfAbsent({
          tenantId: input.tenantId,
          aggregateId: passenger.id,
          eventType: "payment.hold.expired",
          payload: {
            registrationId: passenger.id,
            holdId: resultingHold.id,
            expiredAt,
            dueAt: resultingHold.dueAt,
            guestUserId: passenger.submittedByUserId,
          },
          domainEventId: `payment.hold.expired:${resultingHold.id}:${resultingHold.dueAt}`,
        });
      }
      setBookingPaymentDueAtProjection({
        tenantId: input.tenantId,
        bookingId: passenger.id,
        paymentDueAt: null,
      });
      if (!prisma) removeAllocationsForPassenger(input.tenantId, passenger.id);
    }
    if (!wasExpiredBooking && driverExpiryDeferred) {
      return { status: "deferred", tenantId: input.tenantId, tourId: booking.tourId };
    }
    if (!isExpirableHoldStatus(hold.status) && !wasExpiredBooking) return null;
    if (!prisma) {
      if (isExpirableHoldStatus(hold.status)) {
        await holdService.expire(input.tenantId, input.registrationId);
      }
      removeAllocationsForDriver(input.tenantId, booking.tourId, booking.id);
      appendBookingOutboxEventIfAbsent({
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
        domainEventId: `payment.hold.expired:${hold.id}:${hold.dueAt}`,
      });
    }
    setBookingPaymentDueAtProjection({
      tenantId: input.tenantId,
      bookingId: input.registrationId,
      paymentDueAt: null,
    });
    return { status: "expired", tenantId: input.tenantId, tourId: booking.tourId };
  }

  if (!wasExpiredBooking) {
    const bookingsService = await resolveBookingsServiceForTenant(input.tenantId);
    try {
      await repo.cancelBooking({
        bookingId: input.registrationId,
        tenantId: input.tenantId,
        outboxEvent: "registration.cancelled",
        cancelSource: "payment_deadline",
        assertCapacityAfterRemovalInTx: await bookingsService.createCapacityReleaseAssertion(
          input.tenantId
        ),
        serialBookingMutationAlreadyHeld: true,
      });
    } catch (error) {
      if (!(error instanceof PaymentDeadlinePaymentAlreadySettledError)) throw error;
      const current = await repo.getById(input.registrationId, input.tenantId);
      if (current?.paymentStatus !== "paid") throw error;
      await holdService.satisfy(input.tenantId, input.registrationId);
      return null;
    }
  }

  const expiredAt = new Date().toISOString();
  if (isExpirableHoldStatus(hold.status)) {
    await holdService.expire(input.tenantId, input.registrationId);
  }

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
      guestUserId: booking.submittedByUserId,
    },
    domainEventId: `payment.hold.expired:${hold.id}:${hold.dueAt}`,
  });

  return { status: "expired", tenantId: input.tenantId, tourId: booking.tourId };
}

/** Expire hold inside an existing serial booking lock (no nested lock; no waitlist promote). */
export async function expirePaymentHoldForRegistrationWithinLock(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<"expired" | "deferred" | "unchanged"> {
  if (!isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return "unchanged";
  }
  const result = await expirePaymentHoldForRegistrationImpl(input);
  return result?.status ?? "unchanged";
}

export async function expirePaymentHoldForRegistration(input: {
  readonly tenantId: string;
  readonly registrationId: string;
}): Promise<"expired" | "deferred" | "unchanged"> {
  if (!isPaymentHoldEnabled() || !isPaymentHoldExpiryEnabled()) {
    return "unchanged";
  }

  const result = await runSerialBookingMutation(async () =>
    expirePaymentHoldForRegistrationImpl(input)
  );
  if (result?.status === "expired") {
    await promoteOldestWaitlistedGuest(result);
  }
  return result?.status ?? "unchanged";
}

/** @deprecated Use expirePaymentHoldForRegistration — same serial lock. */
export const expirePaymentHoldForRegistrationLocked = expirePaymentHoldForRegistration;
