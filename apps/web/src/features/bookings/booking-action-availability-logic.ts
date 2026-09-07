import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";

export type BookingActionUnavailableReasonCode =
  | "terminal_state"
  | "wrong_status"
  | "approved_use_finance"
  | "not_admin"
  | "capacity_full"
  | "waitlist_not_applicable"
  | "cancel_not_allowed";

export type BookingActionAvailabilityInput = {
  readonly canManageOps: boolean;
  readonly booking: BookingListItem | null;
  readonly isWaitlistable: boolean;
  readonly isCancellable: boolean;
  readonly capacityFull: boolean;
};

export type BookingActionAvailability = {
  readonly canApprove: boolean;
  readonly canApproveWithoutPayment: boolean;
  readonly canReject: boolean;
  readonly canWaitlist: boolean;
  readonly canCancel: boolean;
  readonly canMarkPresent: boolean;
  readonly canMarkAbsent: boolean;
  readonly unavailableReason: BookingActionUnavailableReasonCode | null;
  readonly showCapacityFullHint: boolean;
};

const TERMINAL_STATUSES = new Set(["rejected", "cancelled"]);
const APPROVABLE_STATUSES = new Set(["pending", "waitlisted"]);

export function resolveBookingActionAvailability(
  input: BookingActionAvailabilityInput
): BookingActionAvailability {
  const status = input.booking?.status ?? null;

  if (!input.canManageOps) {
    return inactive("not_admin");
  }

  if (status === null) {
    return inactive(null);
  }

  if (TERMINAL_STATUSES.has(status)) {
    return inactive("terminal_state");
  }

  if (status === "approved") {
    const attendanceMarked =
      input.booking?.attendanceStatus === "present" ||
      input.booking?.attendanceStatus === "absent";
    return {
      canApprove: false,
      canApproveWithoutPayment: false,
      canReject: false,
      canWaitlist: false,
      canCancel: input.isCancellable,
      canMarkPresent: !attendanceMarked,
      canMarkAbsent: !attendanceMarked,
      unavailableReason: attendanceMarked ? "approved_use_finance" : "approved_use_finance",
      showCapacityFullHint: false,
    };
  }

  if (!APPROVABLE_STATUSES.has(status)) {
    return inactive("wrong_status");
  }

  const canAct = true;
  return {
    canApprove: canAct,
    canApproveWithoutPayment: canAct,
    canReject: canAct,
    canWaitlist: input.isWaitlistable,
    canCancel: input.isCancellable,
    canMarkPresent: false,
    canMarkAbsent: false,
    unavailableReason: null,
    showCapacityFullHint: input.capacityFull,
  };
}

function inactive(reason: BookingActionUnavailableReasonCode | null): BookingActionAvailability {
  return {
    canApprove: false,
    canApproveWithoutPayment: false,
    canReject: false,
    canWaitlist: false,
    canCancel: false,
    canMarkPresent: false,
    canMarkAbsent: false,
    unavailableReason: reason,
    showCapacityFullHint: false,
  };
}

export function bookingActionUnavailableMessageKey(
  reason: BookingActionUnavailableReasonCode
): string {
  return `actionReason.${reason}`;
}
