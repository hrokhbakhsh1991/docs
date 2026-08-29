/**
 * DP1-C — approve side effects: commercial quote freeze + payment hold scheduling.
 */
import { getBookingsRepository } from "../bookings/create-bookings-repository.ts";
import {
  appendBookingOutboxEventIfAbsent,
  setBookingPaymentDueAtProjection,
} from "../bookings/in-memory-bookings.repository.ts";
import { ensureFrozenCommercialQuoteOnApprove } from "./commercial-quote-approve.service.ts";
import { isPaymentHoldEnabled, PaymentHoldService } from "./payment-hold.service.ts";
import { resolvePaymentHoldPolicyHoursForBooking } from "./resolve-payment-hold-policy-for-booking.ts";

export type PaymentHoldApproveSideEffects = {
  readonly paymentDueAt?: string;
  readonly holdStatus?: string;
  readonly commercialQuotePayableMinor?: string;
};

export async function applyPaymentHoldAfterBookingApprove(input: {
  readonly tenantId: string;
  readonly bookingId: string;
  readonly approvedAt: string;
}): Promise<PaymentHoldApproveSideEffects> {
  if (!isPaymentHoldEnabled()) {
    return {};
  }

  const frozen = await ensureFrozenCommercialQuoteOnApprove({
    tenantId: input.tenantId,
    registrationId: input.bookingId,
  });
  const payableMinor = frozen?.payableMinor ?? "0";
  const sideEffects: PaymentHoldApproveSideEffects = {
    commercialQuotePayableMinor: payableMinor,
  };

  if (payableMinor === "0" || frozen?.source === "free_collection") {
    return { ...sideEffects, holdStatus: "satisfied" };
  }

  const policyHours = await resolvePaymentHoldPolicyHoursForBooking({
    tenantId: input.tenantId,
    bookingId: input.bookingId,
  });
  if (policyHours === null) {
    return sideEffects;
  }

  const holdService = new PaymentHoldService();
  const hold = await holdService.scheduleOnApprove({
    tenantId: input.tenantId,
    registrationId: input.bookingId,
    approvedAt: input.approvedAt,
    policyHours,
  });

  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.bookingId,
    paymentDueAt: hold.dueAt,
  });

  appendBookingOutboxEventIfAbsent({
    tenantId: input.tenantId,
    aggregateId: input.bookingId,
    eventType: "payment.hold.scheduled",
    payload: {
      registrationId: input.bookingId,
      holdId: hold.id,
      dueAt: hold.dueAt,
      policyHours: hold.policyHours,
      approvedAt: input.approvedAt,
    },
    domainEventId: `payment.hold.scheduled:${input.bookingId}:${input.approvedAt}`,
  });

  return {
    paymentDueAt: hold.dueAt,
    holdStatus: "open",
    commercialQuotePayableMinor: payableMinor,
  };
}

export async function closePaymentHoldOnOperatorCancel(input: {
  readonly tenantId: string;
  readonly bookingId: string;
}): Promise<void> {
  if (!isPaymentHoldEnabled()) {
    return;
  }
  const holdService = new PaymentHoldService();
  const hold = await holdService.getByRegistrationId(input.tenantId, input.bookingId);
  if (hold === null || (hold.status !== "open" && hold.status !== "extended")) {
    return;
  }
  await holdService.satisfy(input.tenantId, input.bookingId);
  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.bookingId,
    paymentDueAt: null,
  });
}

export async function satisfyPaymentHoldIfFullyPaid(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly remainingMinor: string;
}): Promise<void> {
  if (!isPaymentHoldEnabled()) {
    return;
  }
  const digits = input.remainingMinor.replace(/\D/g, "");
  if (digits.length === 0 || BigInt(digits) > BigInt(0)) {
    return;
  }
  const holdService = new PaymentHoldService();
  const hold = await holdService.getByRegistrationId(input.tenantId, input.registrationId);
  if (hold === null || (hold.status !== "open" && hold.status !== "extended")) {
    return;
  }
  await holdService.satisfy(input.tenantId, input.registrationId);
  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.registrationId,
    paymentDueAt: null,
  });
}

/** Test helper — seed booking row for migration fixtures. */
export function seedBookingRecordForPaymentHoldMigration(
  record: Parameters<ReturnType<typeof getBookingsRepository>["seedBooking"]>[0]
): void {
  getBookingsRepository().seedBooking(record);
}
