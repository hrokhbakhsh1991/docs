import type { BookingActorContext } from "./booking-actor-context";
import type { BookingRepositoryPort } from "./booking-repository.port";
import type { BookingRecord } from "../bookings.types";

export type BookingPostCancelSideEffectsInput = {
  readonly auth: BookingActorContext;
  readonly booking: BookingRecord;
  readonly previousStatus: string;
  readonly cancelDomainEventId: string;
  readonly cancelSource?: string;
  readonly tourCancelled?: boolean;
  /** Keep side effects on the same repository instance as the lifecycle write. */
  readonly repository?: Pick<
    BookingRepositoryPort,
    "getById" | "appendOutboxEventIfAbsent" | "recordCancellationEffect"
  >;
};

export type BookingPostCancelSideEffectsResult = {
  readonly refundDrafted: boolean;
  readonly refundId: string | null;
  readonly eligibleRefundMinor: string;
  readonly refundStatus:
    | "not_required"
    | "pending_finance_approval"
    | "completed"
    | "manual_review";
  readonly waitlistPromoted: boolean;
  readonly waitlistCandidate: boolean;
  readonly settlementStatus: "not_affected" | "correction_pending" | "manual_review";
  readonly notificationStatus: "queued" | "manual_review";
};

export type BookingPostCancelSideEffectsPort = {
  readonly run: (
    input: BookingPostCancelSideEffectsInput
  ) => Promise<BookingPostCancelSideEffectsResult>;
};
