/**
 * DP1-I — operator extend payment hold deadline.
 */
import { setBookingPaymentDueAtProjection } from "../bookings/in-memory-bookings.repository.ts";
import { persistBookingFinanceOutboxEventIfAbsent } from "../outbox/persist-booking-finance-outbox-event.ts";
import { PaymentHoldService } from "./payment-hold.service.ts";

export async function extendPaymentHoldDeadline(input: {
  readonly tenantId: string;
  readonly registrationId: string;
  readonly newDueAt: string;
  readonly actorUserId: string;
}): Promise<{ readonly dueAt: string; readonly holdStatus: string }> {
  const newDueMs = Date.parse(input.newDueAt);
  const nowMs = Date.now();
  if (!Number.isFinite(newDueMs) || newDueMs <= nowMs) {
    throw new Error("PAYMENT_HOLD_EXTEND_DUE_AT_MUST_BE_FUTURE");
  }

  const holdService = new PaymentHoldService();
  const hold = await holdService.extend(input.tenantId, input.registrationId, input.newDueAt);

  setBookingPaymentDueAtProjection({
    tenantId: input.tenantId,
    bookingId: input.registrationId,
    paymentDueAt: hold.dueAt,
  });

  await persistBookingFinanceOutboxEventIfAbsent({
    tenantId: input.tenantId,
    aggregateId: input.registrationId,
    eventType: "payment.hold.extended",
    payload: {
      registrationId: input.registrationId,
      holdId: hold.id,
      dueAt: hold.dueAt,
      actorUserId: input.actorUserId,
    },
    domainEventId: `payment.hold.extended:${hold.id}:${hold.dueAt}`,
  });

  return { dueAt: hold.dueAt, holdStatus: "open" };
}
