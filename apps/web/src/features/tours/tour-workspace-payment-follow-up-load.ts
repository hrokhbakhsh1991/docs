import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";
import { mergePaymentFollowUpParticipants } from "@/features/tours/tour-workspace-payment-follow-up-logic";
import type { TourWorkspacePaymentFollowUpParticipantRow } from "@/features/tours/tour-workspace-payment-follow-up-logic";
import type { TourOperationalRosterRow } from "@/features/tours/tour-workspace-transport-logic";

export type PaymentFollowUpPendingRead =
  | { readonly ok: true; readonly items: readonly BookingListItem[] }
  | { readonly ok: false; readonly error: string };

export type PaymentFollowUpRosterRead =
  | { readonly ok: true; readonly items: readonly TourOperationalRosterRow[] }
  | { readonly ok: false; readonly error: string };

export type PaymentFollowUpLoadOutcome = {
  readonly rows: readonly TourWorkspacePaymentFollowUpParticipantRow[];
  readonly error: string | null;
  readonly rosterDegraded: boolean;
};

export function resolvePaymentFollowUpLoadOutcome(input: {
  readonly pending: PaymentFollowUpPendingRead;
  readonly roster: PaymentFollowUpRosterRead;
}): PaymentFollowUpLoadOutcome {
  if (!input.pending.ok && !input.roster.ok) {
    return {
      rows: [],
      error: input.pending.error,
      rosterDegraded: false,
    };
  }

  const pendingBookings = input.pending.ok ? input.pending.items : [];
  const rosterRows = input.roster.ok ? input.roster.items : [];
  const rosterDegraded = !input.roster.ok;

  return {
    rows: mergePaymentFollowUpParticipants({ pendingBookings, rosterRows }),
    error: input.pending.ok ? (rosterDegraded ? input.roster.error : null) : input.pending.error,
    rosterDegraded,
  };
}

export function toPaymentFollowUpHttpError(prefix: string, status: number): string {
  return `${prefix}_${status}`;
}
