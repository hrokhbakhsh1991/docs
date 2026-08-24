/**
 * DP-6 — operator tour cancellation (batch registration cancel + refund drafts).
 */
import { BOOKING_CANCEL_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { getBookingsRepository } from "./create-bookings-repository.ts";
import { runPostCancelSideEffects } from "./post-cancel-side-effects.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import { handleTourCancelledForSettlement } from "../settlement/driver-settlement.service.ts";

export type TourCancellationResult = {
  readonly tourId: string;
  readonly cancelledRegistrationIds: readonly string[];
  readonly refundDraftCount: number;
};

const ACTIVE_STATUSES = new Set(["pending", "waitlisted", "approved"]);

export async function cancelTourRegistrations(
  auth: BookingActorContext,
  tourId: string
): Promise<TourCancellationResult> {
  const repo = getBookingsRepository();
  const rows = (await repo.listByTenant(auth.tenantId)).filter(
    (row) => row.tourId === tourId && ACTIVE_STATUSES.has(row.status)
  );

  const cancelledRegistrationIds: string[] = [];
  let refundDraftCount = 0;

  for (const row of rows) {
    const previousStatus = row.status;
    await repo.cancelBooking({
      bookingId: row.id,
      tenantId: auth.tenantId,
      outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
      cancelSource: "tour",
    });
    const effects = await runPostCancelSideEffects({
      auth,
      booking: { ...row, status: "cancelled", cancelSource: "tour" },
      previousStatus,
      cancelDomainEventId: `registration.cancelled:${row.id}`,
      cancelSource: "tour",
      tourCancelled: true,
    });
    if (effects.refundDrafted) {
      refundDraftCount += 1;
    }
    cancelledRegistrationIds.push(row.id);
  }

  try {
    await handleTourCancelledForSettlement(auth, tourId);
  } catch {
    // transport optional
  }

  return { tourId, cancelledRegistrationIds, refundDraftCount };
}
