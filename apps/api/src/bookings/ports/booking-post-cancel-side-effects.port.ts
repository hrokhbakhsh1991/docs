import type { BookingActorContext } from "./booking-actor-context";
import type { BookingRecord } from "../bookings.types";

export type BookingPostCancelSideEffectsInput = {
  readonly auth: BookingActorContext;
  readonly booking: BookingRecord;
  readonly previousStatus: string;
  readonly cancelDomainEventId: string;
  readonly cancelSource?: string;
  readonly tourCancelled?: boolean;
};

export type BookingPostCancelSideEffectsResult = {
  readonly refundDrafted: boolean;
  readonly refundId: string | null;
  readonly eligibleRefundMinor: string;
  readonly waitlistPromoted: boolean;
};

export type BookingPostCancelSideEffectsPort = {
  readonly run: (
    input: BookingPostCancelSideEffectsInput
  ) => Promise<BookingPostCancelSideEffectsResult>;
};
