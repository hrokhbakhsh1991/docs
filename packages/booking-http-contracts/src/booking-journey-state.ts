import type { BookingPaymentStatus, BookingStatus } from "./booking-status";

export type BookingJourneyState =
  | "pending"
  | "waitlisted"
  | "approved_unpaid"
  | "approved_partial"
  | "approved_paid"
  | "rejected"
  | "cancelled";

export function resolveBookingJourneyState(input: {
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
}): BookingJourneyState {
  if (input.status === "approved") {
    switch (input.paymentStatus) {
      case "paid":
        return "approved_paid";
      case "partial":
        return "approved_partial";
      case "unpaid":
        return "approved_unpaid";
      default: {
        const exhaustive: never = input.paymentStatus;
        return exhaustive;
      }
    }
  }

  switch (input.status) {
    case "pending":
      return "pending";
    case "waitlisted":
      return "waitlisted";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    default: {
      const exhaustive: never = input.status;
      return exhaustive;
    }
  }
}

export function isApprovedBookingJourneyState(state: BookingJourneyState): boolean {
  return (
    state === "approved_unpaid" ||
    state === "approved_partial" ||
    state === "approved_paid"
  );
}

export function isApprovedBookingJourneyStateUnsettled(
  state: BookingJourneyState
): boolean {
  return state === "approved_unpaid" || state === "approved_partial";
}
