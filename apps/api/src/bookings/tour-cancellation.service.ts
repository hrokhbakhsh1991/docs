/**
 * DP-6 — operator tour cancellation (batch registration cancel + refund drafts).
 */
import { BOOKING_CANCEL_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { getBookingsRepository } from "./create-bookings-repository.ts";
import { runPostCancelSideEffects } from "./post-cancel-side-effects.ts";
import type { PostCancelSideEffectsResult } from "./post-cancel-side-effects.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import type { BookingRepositoryPort } from "./ports/booking-repository.port.ts";
import type { BookingRecord } from "./bookings.types.ts";
import { handleTourCancelledForSettlement } from "../settlement/driver-settlement.service.ts";

export type TourCancellationResult = {
  readonly tourId: string;
  readonly cancelledRegistrationIds: readonly string[];
  readonly refundDraftCount: number;
  readonly manualReviewRegistrationIds: readonly string[];
  readonly failedRegistrationIds: readonly string[];
  readonly settlementStatus: "completed" | "manual_review";
};

const ACTIVE_STATUSES = new Set(["pending", "waitlisted", "approved"]);

type TourCancellationDependencies = {
  readonly repository?: Pick<BookingRepositoryPort, "listByTenant" | "cancelBooking">;
  readonly postCancelSideEffects?: (input: {
    readonly auth: BookingActorContext;
    readonly booking: BookingRecord;
    readonly previousStatus: string;
    readonly cancelDomainEventId: string;
    readonly cancelSource?: string;
    readonly tourCancelled?: boolean;
  }) => Promise<PostCancelSideEffectsResult>;
  readonly handleTourCancelledForSettlement?: (
    auth: BookingActorContext,
    tourId: string
  ) => Promise<void>;
};

export async function cancelTourRegistrations(
  auth: BookingActorContext,
  tourId: string,
  dependencies: TourCancellationDependencies = {}
): Promise<TourCancellationResult> {
  const repo = dependencies.repository ?? getBookingsRepository();
  const postCancelSideEffects = dependencies.postCancelSideEffects ?? runPostCancelSideEffects;
  const settleTour =
    dependencies.handleTourCancelledForSettlement ?? handleTourCancelledForSettlement;
  const rows = (await repo.listByTenant(auth.tenantId)).filter(
    (row) => row.tourId === tourId && ACTIVE_STATUSES.has(row.status)
  );

  const cancelledRegistrationIds: string[] = [];
  const manualReviewRegistrationIds: string[] = [];
  const failedRegistrationIds: string[] = [];
  let refundDraftCount = 0;
  let settlementStatus: TourCancellationResult["settlementStatus"] = "completed";

  for (const row of rows) {
    const previousStatus = row.status;
    try {
      await repo.cancelBooking({
        bookingId: row.id,
        tenantId: auth.tenantId,
        outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
        cancelSource: "tour",
      });
    } catch {
      failedRegistrationIds.push(row.id);
      continue;
    }

    cancelledRegistrationIds.push(row.id);
    try {
      const effects = await postCancelSideEffects({
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
      if (effects.settlementStatus !== "not_affected") {
        manualReviewRegistrationIds.push(row.id);
      }
    } catch {
      manualReviewRegistrationIds.push(row.id);
    }
  }

  if (failedRegistrationIds.length > 0 || manualReviewRegistrationIds.length > 0) {
    settlementStatus = "manual_review";
  }

  try {
    await settleTour(auth, tourId);
  } catch {
    settlementStatus = "manual_review";
  }

  return {
    tourId,
    cancelledRegistrationIds,
    refundDraftCount,
    manualReviewRegistrationIds,
    failedRegistrationIds,
    settlementStatus,
  };
}
