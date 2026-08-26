/**
 * Tour workspace payment follow-up — participant row model (DP-2 roster + pending bookings).
 */
import type { BookingListItem } from "@/features/bookings/bookings-command-center-types";
import type { TourFinanceListFilter } from "@/features/tours/tour-workspace-finance-logic";
import type { TourOperationalRosterRow } from "@/features/tours/tour-workspace-transport-logic";

export type PaymentFollowUpPrimaryActionKind =
  | "approve_awaiting_payment"
  | "approve_without_payment"
  | "follow_up_payment"
  | "follow_up_partial"
  | "none";

export type PaymentFollowUpListKind =
  | "pending"
  | "unpaid"
  | "partial"
  | "settled"
  | "waitlisted"
  | "rejected"
  | "cancelled";

export type TourWorkspacePaymentFollowUpParticipantRow = {
  readonly key: string;
  readonly registrationId: string;
  readonly displayName: string;
  readonly memberUserId?: string;
  readonly memberAvatarUrl?: string | null;
  readonly registrationStatus: string;
  readonly financialDisplayState: string | null;
  readonly bookingPaymentStatus: "unpaid" | "partial" | "paid" | null;
  readonly remainingMinor: string | null;
  readonly currency: string | null;
  readonly paymentDueAt: string | null;
  readonly isFinalParticipant: boolean;
  readonly listKind: PaymentFollowUpListKind;
  readonly primaryAction: PaymentFollowUpPrimaryActionKind;
  readonly secondaryAction: PaymentFollowUpPrimaryActionKind | null;
};

export function resolvePaymentFollowUpPrimaryAction(input: {
  readonly registrationStatus: string;
  readonly financialDisplayState: string | null;
}): {
  readonly primary: PaymentFollowUpPrimaryActionKind;
  readonly secondary: PaymentFollowUpPrimaryActionKind | null;
} {
  const status = input.registrationStatus.trim().toLowerCase();
  if (status === "pending") {
    return {
      primary: "approve_awaiting_payment",
      secondary: "approve_without_payment",
    };
  }
  if (status === "waitlisted") {
    return { primary: "none", secondary: null };
  }
  if (status === "rejected" || status === "cancelled") {
    return { primary: "none", secondary: null };
  }
  const financial = input.financialDisplayState?.trim().toUpperCase() ?? "";
  if (financial === "UNPAID") {
    return { primary: "follow_up_payment", secondary: null };
  }
  if (financial === "PARTIALLY_PAID") {
    return { primary: "follow_up_partial", secondary: null };
  }
  return { primary: "none", secondary: null };
}

function resolveListKind(input: {
  readonly registrationStatus: string;
  readonly financialDisplayState: string | null;
}): PaymentFollowUpListKind {
  const status = input.registrationStatus.trim().toLowerCase();
  if (status === "pending") {
    return "pending";
  }
  if (status === "waitlisted") {
    return "waitlisted";
  }
  if (status === "rejected") {
    return "rejected";
  }
  if (status === "cancelled") {
    return "cancelled";
  }
  const financial = input.financialDisplayState?.trim().toUpperCase() ?? "";
  if (financial === "UNPAID") {
    return "unpaid";
  }
  if (financial === "PARTIALLY_PAID") {
    return "partial";
  }
  return "settled";
}

export function mapPendingBookingToFollowUpRow(
  booking: BookingListItem
): TourWorkspacePaymentFollowUpParticipantRow {
  const actions = resolvePaymentFollowUpPrimaryAction({
    registrationStatus: booking.status,
    financialDisplayState: null,
  });
  return {
    key: `pending:${booking.id}`,
    registrationId: booking.id,
    displayName: booking.guestLabel,
    ...(booking.memberUserId !== undefined ? { memberUserId: booking.memberUserId } : {}),
    ...(booking.memberAvatarUrl !== undefined ? { memberAvatarUrl: booking.memberAvatarUrl } : {}),
    registrationStatus: booking.status,
    financialDisplayState: null,
    bookingPaymentStatus: booking.paymentStatus,
    remainingMinor: null,
    currency: null,
    paymentDueAt: booking.paymentDueAt ?? null,
    isFinalParticipant: false,
    listKind: "pending",
    primaryAction: actions.primary,
    secondaryAction: actions.secondary,
  };
}

export function mapRosterRowToFollowUpParticipant(
  row: TourOperationalRosterRow
): TourWorkspacePaymentFollowUpParticipantRow {
  const actions = resolvePaymentFollowUpPrimaryAction({
    registrationStatus: row.registrationStatus,
    financialDisplayState: row.financialDisplayState,
  });
  const bookingPaymentStatus =
    row.financialDisplayState === "PARTIALLY_PAID"
      ? "partial"
      : row.financialDisplayState === "PAID" || row.financialDisplayState === "WAIVED"
        ? "paid"
        : row.financialDisplayState === "UNPAID"
          ? "unpaid"
          : null;
  return {
    key: `roster:${row.registrationId}`,
    registrationId: row.registrationId,
    displayName: row.guestLabel,
    ...(row.memberUserId !== undefined ? { memberUserId: row.memberUserId } : {}),
    ...(row.memberAvatarUrl !== undefined ? { memberAvatarUrl: row.memberAvatarUrl } : {}),
    registrationStatus: row.registrationStatus,
    financialDisplayState: row.financialDisplayState,
    bookingPaymentStatus,
    remainingMinor: row.remainingMinor,
    currency: row.currency,
    paymentDueAt: row.paymentDueAt,
    isFinalParticipant: row.isFinalParticipant,
    listKind: resolveListKind({
      registrationStatus: row.registrationStatus,
      financialDisplayState: row.financialDisplayState,
    }),
    primaryAction: actions.primary,
    secondaryAction: actions.secondary,
  };
}

export function mergePaymentFollowUpParticipants(input: {
  readonly pendingBookings: readonly BookingListItem[];
  readonly rosterRows: readonly TourOperationalRosterRow[];
}): readonly TourWorkspacePaymentFollowUpParticipantRow[] {
  const seen = new Set<string>();
  const rows: TourWorkspacePaymentFollowUpParticipantRow[] = [];
  for (const booking of input.pendingBookings) {
    if (booking.status !== "pending") {
      continue;
    }
    rows.push(mapPendingBookingToFollowUpRow(booking));
    seen.add(booking.id);
  }
  for (const rosterRow of input.rosterRows) {
    if (seen.has(rosterRow.registrationId)) {
      continue;
    }
    rows.push(mapRosterRowToFollowUpParticipant(rosterRow));
    seen.add(rosterRow.registrationId);
  }
  return rows.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
}

export function filterPaymentFollowUpParticipants(
  rows: readonly TourWorkspacePaymentFollowUpParticipantRow[],
  filter: TourFinanceListFilter,
  searchQuery: string
): readonly TourWorkspacePaymentFollowUpParticipantRow[] {
  const q = searchQuery.trim().toLowerCase();
  return rows.filter((row) => {
    if (filter === "unpaid" && row.listKind !== "unpaid" && row.listKind !== "pending") {
      return false;
    }
    if (filter === "partial" && row.listKind !== "partial") {
      return false;
    }
    if (q.length === 0) {
      return true;
    }
    return row.displayName.toLowerCase().includes(q);
  });
}

export function findPaymentFollowUpParticipant(
  rows: readonly TourWorkspacePaymentFollowUpParticipantRow[],
  registrationId: string | null
): TourWorkspacePaymentFollowUpParticipantRow | null {
  const id = registrationId?.trim() ?? "";
  if (id.length === 0) {
    return null;
  }
  return rows.find((row) => row.registrationId === id) ?? null;
}

export function paymentFollowUpPrimaryActionLabelKey(
  kind: PaymentFollowUpPrimaryActionKind
): string | null {
  switch (kind) {
    case "approve_awaiting_payment":
      return "approveAwaitingPayment";
    case "approve_without_payment":
      return "approveWithoutPayment";
    case "follow_up_payment":
      return "ctaFollowUpPayment";
    case "follow_up_partial":
      return "ctaFollowUpPartialPayment";
    default:
      return null;
  }
}

export function shouldShowPaymentFollowUpDeadline(row: TourWorkspacePaymentFollowUpParticipantRow): boolean {
  if (row.paymentDueAt === null || row.paymentDueAt.trim().length === 0) {
    return false;
  }
  return (
    row.primaryAction === "follow_up_payment" ||
    row.primaryAction === "follow_up_partial" ||
    row.primaryAction === "approve_awaiting_payment"
  );
}
