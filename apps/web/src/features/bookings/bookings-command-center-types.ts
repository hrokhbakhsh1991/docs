export type BookingsListView = "ops" | "mine";

export type BookingStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled"
  | "all";

export type BookingPaymentStatus = "unpaid" | "partial" | "paid" | "all";

export type BookingsCommandCenterQuery = {
  readonly view: BookingsListView;
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
  readonly tourId: string;
  readonly search: string;
  readonly scope: string;
};

export type BookingTourChip = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly pendingCount: number;
  readonly totalCount: number;
};

export type BookingListItem = {
  readonly id: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly partySize: number;
  readonly status: Exclude<BookingStatus, "all">;
  readonly paymentStatus: "unpaid" | "partial" | "paid";
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
};

export type BookingsListResponse = {
  readonly items: readonly BookingListItem[];
  readonly total: number;
  readonly nextCursor: string | null;
};

export type BookingsSummaryResponse = {
  readonly pending: number;
  readonly approvedToday: number;
  readonly departures7d: number;
  readonly waitlist: number;
  readonly tourChips: readonly BookingTourChip[];
};

export const BULK_APPROVE_MAX_BATCH = 25;

export const BOOKINGS_COMMAND_CENTER_TEST_IDS = {
  page: "operator-bookings-page",
  kpiStrip: "operator-bookings-kpi",
  tourChips: "operator-bookings-tour-chips",
  inbox: "operator-bookings-inbox",
  inspection: "operator-bookings-inspection",
  approveButton: "operator-bookings-approve",
  rejectButton: "operator-bookings-reject",
  bulkApproveButton: "operator-bookings-bulk-approve",
  locked: "operator-bookings-locked",
  leaderAlias: "operator-leader-review-alias",
} as const;

export const DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY: BookingsCommandCenterQuery = {
  view: "ops",
  status: "all",
  paymentStatus: "all",
  tourId: "",
  search: "",
  scope: "",
};

export const PAYMENT_STATUS_FILTER_OPTIONS = ["all", "unpaid", "partial", "paid"] as const;

export const BOOKING_STATUS_FILTER_OPTIONS = [
  "all",
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const;

export function isAdminOrOwnerRole(role: string): boolean {
  return role === "admin" || role === "owner";
}

export function resolveBookingsViewForRole(
  role: string,
  requestedView: BookingsListView
): BookingsListView {
  if (!isAdminOrOwnerRole(role)) {
    return "mine";
  }
  return requestedView;
}
