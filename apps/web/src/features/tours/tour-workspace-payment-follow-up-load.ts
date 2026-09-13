import { mergePaymentFollowUpParticipants } from "@/features/tours/tour-workspace-payment-follow-up-logic";
import type { TourWorkspacePaymentFollowUpParticipantRow } from "@/features/tours/tour-workspace-payment-follow-up-logic";
import type { TourOperationalRosterRow } from "@/features/tours/tour-workspace-transport-logic";

export type PaymentFollowUpRosterRead =
  | { readonly ok: true; readonly items: readonly TourOperationalRosterRow[] }
  | { readonly ok: false; readonly error: string };

export type PaymentFollowUpLoadOutcome = {
  readonly rows: readonly TourWorkspacePaymentFollowUpParticipantRow[];
  readonly error: string | null;
  readonly rosterDegraded: boolean;
};

export function resolvePaymentFollowUpLoadOutcome(input: {
  readonly roster: PaymentFollowUpRosterRead;
}): PaymentFollowUpLoadOutcome {
  if (!input.roster.ok) {
    return {
      rows: [],
      error: input.roster.error,
      rosterDegraded: true,
    };
  }

  const rosterRows = input.roster.items;

  return {
    rows: mergePaymentFollowUpParticipants({ rosterRows }),
    error: null,
    rosterDegraded: false,
  };
}

export function toPaymentFollowUpHttpError(prefix: string, status: number): string {
  return `${prefix}_${status}`;
}
