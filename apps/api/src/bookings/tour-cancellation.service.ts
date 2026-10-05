/**
 * DP-6 — operator tour cancellation (batch registration cancel + refund drafts).
 */
import { BOOKING_CANCEL_OUTBOX_EVENT_TYPE } from "@app-tour/booking-http-contracts";

import { getBookingsRepository } from "./create-bookings-repository.ts";
import { runPostCancelSideEffects } from "./post-cancel-side-effects.ts";
import type { BookingRecord } from "./bookings.types.ts";
import type { BookingActorContext } from "./ports/booking-actor-context.ts";
import { handleTourCancelledForSettlement } from "../settlement/driver-settlement.service.ts";

export type TourCancellationResult = {
  readonly tourId: string;
  readonly cancelledRegistrationIds: readonly string[];
  readonly refundDraftCount: number;
  readonly manualReviewRegistrationIds: readonly string[];
  readonly failures: readonly {
    readonly registrationId: string | null;
    readonly stage: "lifecycle" | "side_effects" | "tour_settlement";
    readonly code: string;
  }[];
};

const ACTIVE_STATUSES = new Set(["pending", "waitlisted", "approved"]);

function cancellationFailureCode(error: unknown): string {
  return error instanceof Error && error.message.trim().length > 0
    ? error.message.trim().slice(0, 160)
    : "CANCELLATION_STAGE_FAILED";
}

export async function cancelTourRegistrations(
  auth: BookingActorContext,
  tourId: string
): Promise<TourCancellationResult> {
  const repo = getBookingsRepository();
  const rows: BookingRecord[] = [];
  let cursor: string | undefined;
  do {
    const page = await repo.listByTenantPage({
      tenantId: auth.tenantId,
      tourId,
      statuses: ["pending", "waitlisted", "approved", "cancelled"],
      limit: 500,
      ...(cursor !== undefined ? { cursor } : {}),
    });
    rows.push(
      ...page.items.filter(
        (row) =>
          ACTIVE_STATUSES.has(row.status) ||
          (row.status === "cancelled" && row.cancelSource === "tour")
      )
    );
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  const cancelledRegistrationIds = new Set<string>();
  const manualReviewRegistrationIds = new Set<string>();
  const failures: TourCancellationResult["failures"][number][] = [];
  let refundDraftCount = 0;

  for (const row of rows) {
    const correlationId =
      row.cancellationCorrelationId ?? `tour.cancelled:${tourId}:registration:${row.id}`;
    const recovering = row.status === "cancelled" && row.cancelSource === "tour";
    const previousStatus = recovering ? (row.cancellationPreviousStatus ?? "approved") : row.status;

    let cancelledBooking = row;
    if (!recovering) {
      try {
        cancelledBooking = await repo.cancelBooking({
          bookingId: row.id,
          tenantId: auth.tenantId,
          outboxEvent: BOOKING_CANCEL_OUTBOX_EVENT_TYPE,
          cancelSource: "tour",
          cancellationStatus: "applied",
          cancellationReasonCode: "tour_cancelled",
          cancellationApprovedByUserId: auth.userId,
          cancellationCorrelationId: correlationId,
        });
      } catch (error) {
        manualReviewRegistrationIds.add(row.id);
        failures.push({
          registrationId: row.id,
          stage: "lifecycle",
          code: cancellationFailureCode(error),
        });
        continue;
      }
    }
    cancelledRegistrationIds.add(row.id);

    try {
      const effects = await runPostCancelSideEffects({
        auth,
        booking: {
          ...row,
          ...cancelledBooking,
          status: "cancelled",
          cancelSource: "tour",
        },
        previousStatus,
        cancelDomainEventId: correlationId,
        cancelSource: "tour",
        tourCancelled: true,
        repository: repo,
      });
      if (effects.refundDrafted) {
        refundDraftCount += 1;
      }
      if (
        effects.refundStatus === "manual_review" ||
        effects.settlementStatus === "manual_review" ||
        effects.settlementStatus === "correction_pending" ||
        effects.notificationStatus === "manual_review"
      ) {
        manualReviewRegistrationIds.add(row.id);
      }
    } catch (error) {
      manualReviewRegistrationIds.add(row.id);
      failures.push({
        registrationId: row.id,
        stage: "side_effects",
        code: cancellationFailureCode(error),
      });
    }
  }

  try {
    await handleTourCancelledForSettlement(auth, tourId);
  } catch (error) {
    failures.push({
      registrationId: null,
      stage: "tour_settlement",
      code: cancellationFailureCode(error),
    });
  }

  return {
    tourId,
    cancelledRegistrationIds: [...cancelledRegistrationIds],
    refundDraftCount,
    manualReviewRegistrationIds: [...manualReviewRegistrationIds],
    failures,
  };
}
