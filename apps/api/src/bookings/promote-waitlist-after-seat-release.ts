/**
 * FIFO waitlist promotion after an approved seat is released (DP-1 / DP-4 shared).
 */
import { getBookingsRepository } from "./create-bookings-repository.ts";
import {
  setBookingPaymentDueAtProjection,
} from "./in-memory-bookings.repository.ts";
import { applyPaymentHoldAfterBookingApprove } from "../finance/apply-payment-hold-after-booking-approve.ts";

export async function promoteOldestWaitlistedGuest(input: {
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
