export type BookingsListView = "ops" | "mine";

export type BookingStatus =
  | "pending"
  | "approved"
  | "waitlisted"
  | "rejected"
  | "cancelled"
  | "all"
  /** L1 work queue — pending ∪ waitlisted (URL omits status; API status=pending,waitlisted). */
  | "actionable";

export type BookingPaymentStatus = "unpaid" | "partial" | "paid" | "all";

export type BookingsListSort = "submittedAt" | "departureAt";

/** Manifest-aligned thin layouts (BOOKINGS-OPS-UX P4d / UX-BKG-44). Wire `board` = By Tour grouping — not Kanban. */
export type BookingsCommandCenterLayout = "inbox" | "timeline" | "board";

export type BookingsOpsPresetId = "workQueue" | "upcoming" | "history";

export type BookingsCommandCenterQuery = {
  readonly view: BookingsListView;
  readonly status: BookingStatus;
  readonly paymentStatus: BookingPaymentStatus;
  readonly tourId: string;
  readonly search: string;
  readonly scope: string;
  /** Display sort — also sent to API keyset (P3b-a). Client re-sort remains for loaded-page stability. */
  readonly sort: BookingsListSort;
  /** Mirrors API departureWithinDays (empty = unset). */
  readonly departureWithinDays: string;
  /** Mirrors API approvedWithinDays (empty = unset). Approved-today KPI uses "1". */
  readonly approvedWithinDays: string;
  /**
   * Summary chip membership — empty/ops default; `all` = history escape (P4c).
   * Only affects GET /bookings/summary, not the list query.
   */
  readonly tourChipScope: "" | "all";
  /** Thin layout: inbox · by departure (timeline) · by tour (board wire token). */
  readonly layout: BookingsCommandCenterLayout;
};

export type BookingTourChip = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly pendingCount: number;
  readonly totalCount: number;
};

export type BookingCapacitySnapshot = {
  readonly occupied: number;
  readonly max: number | null;
};

export type BookingListItem = {
  readonly id: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly guestLabel: string;
  readonly guestEmail?: string;
  readonly guestPhone?: string;
  readonly registrantTarget?: "self" | "other";
  /** H5-T3 list scalar — always present on HTTP list; null when unknown. */
  readonly transportKind:
    | "primary"
    | "personal_car"
    | "no_car_dong"
    | "no_car_acquaintance"
    | null;
  readonly personalCarOccupants: 1 | 2 | 3 | null;
  readonly partySize: number;
  readonly status: Exclude<BookingStatus, "all" | "actionable">;
  readonly paymentStatus: "unpaid" | "partial" | "paid";
  readonly financialDisplayState?: "WAIVED";
  readonly departureAt: string;
  readonly submittedAt: string;
  readonly approvedAt?: string;
  readonly registrationIntake?: Readonly<Record<string, unknown>>;
  readonly rejectReason?: string;
  readonly capacitySnapshot?: BookingCapacitySnapshot;
  /** DP1 — Finance hold dueAt projection. */
  readonly paymentDueAt?: string;
  /** DP1 — cancel provenance when status=cancelled. */
  readonly cancelSource?: string | null;
  /** Ops list projection — submitter user id for avatar resolution. */
  readonly memberUserId?: string;
  /** Ops list projection — presigned avatar URL when membership has storage key. */
  readonly memberAvatarUrl?: string | null;
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
  tourChipsMore: "operator-bookings-tour-chips-more",
  upcomingFacet: "operator-bookings-upcoming-facet",
  upcomingFacetDay: (days: 7 | 14 | 30) => `operator-bookings-upcoming-${days}d`,
  departureWindowHint: "operator-bookings-departure-window-hint",
  overdueBadge: "operator-bookings-overdue",
  soonBadge: "operator-bookings-soon",
  tourChipScopeAll: "operator-bookings-tour-chip-scope-all",
  historyHint: "operator-bookings-history-hint",
  opsPresets: "operator-bookings-ops-presets",
  presetsHint: "operator-bookings-presets-hint",
  inspectionActionsHint: "operator-bookings-inspection-actions-hint",
  layoutSwitch: "operator-bookings-layout",
  inbox: "operator-bookings-inbox",
  inspection: "operator-bookings-inspection",
  /** PR21-H1 — booking settlement badge (inbox list row). */
  rowAvatar: "operator-bookings-row-avatar",
  paymentBadgeInbox: "operator-bookings-payment-badge-inbox",
  /** PR21-H1 — booking settlement badge (inspection header). */
  paymentBadgeInspection: "operator-bookings-payment-badge-inspection",
  approveButton: "operator-bookings-approve",
  approveWithoutPaymentButton: "operator-bookings-approve-without-payment",
  inlineApproveButton: "operator-bookings-inline-approve",
  rejectButton: "operator-bookings-reject",
  waitlistButton: "operator-bookings-waitlist",
  cancelButton: "operator-bookings-cancel",
  bulkApproveButton: "operator-bookings-bulk-approve",
  bulkSelectAllButton: "operator-bookings-bulk-select-all",
  clearFiltersButton: "operator-bookings-clear-filters",
  loadMoreButton: "operator-bookings-load-more",
  actionError: "operator-bookings-action-error",
  actionNotice: "operator-bookings-action-notice",
  actionNoticeTransportLink: "operator-bookings-action-notice-transport",
  actionNoticeFinanceLink: "operator-bookings-action-notice-finance",
  actionNoticeWaitlistLink: "operator-bookings-action-notice-waitlist",
  actionNoticeHistoryLink: "operator-bookings-action-notice-history",
  mobileActionBar: "operator-bookings-mobile-actions",
  mobileInspectionSheet: "operator-bookings-mobile-sheet",
  copyBookingIdButton: "operator-bookings-copy-id",
  sortSelect: "operator-bookings-sort",
  nextStepReceiptHint: "operator-bookings-next-step-receipt",
  rejectDialog: "operator-bookings-reject-dialog",
  bulkConfirmDialog: "operator-bookings-bulk-confirm",
  cancelConfirmDialog: "operator-bookings-cancel-confirm",
  cancelConfirmButton: "operator-bookings-cancel-confirm-button",
  overbookConfirmDialog: "operator-bookings-overbook-confirm",
  capacityFullHint: "operator-bookings-capacity-full-hint",
  actionUnavailableHint: "operator-bookings-action-unavailable-hint",
  capacityBar: "operator-bookings-capacity",
  filtersDetails: "operator-bookings-filters-details",
  filtersDirtyBadge: "operator-bookings-filters-dirty",
  advancedFiltersPanel: "operator-bookings-advanced-filters",
  displayMenu: "operator-bookings-display-menu",
  primaryChrome: "operator-bookings-primary-chrome",
  locked: "operator-bookings-locked",
  leaderAlias: "operator-leader-review-alias",
} as const;

export const DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY: BookingsCommandCenterQuery = {
  view: "ops",
  status: "actionable",
  paymentStatus: "all",
  tourId: "",
  search: "",
  scope: "",
  sort: "submittedAt",
  departureWithinDays: "",
  approvedWithinDays: "",
  tourChipScope: "",
  layout: "inbox",
};

export const BOOKINGS_LIST_SORT_OPTIONS = ["submittedAt", "departureAt"] as const;

export const PAYMENT_STATUS_FILTER_OPTIONS = ["all", "unpaid", "partial", "paid"] as const;

/** Status chips — excludes L1 actionable (Work Queue preset / bare URL). */
export const BOOKING_STATUS_FILTER_OPTIONS = [
  "all",
  "pending",
  "approved",
  "waitlisted",
  "rejected",
  "cancelled",
] as const;

/** Wire order for L1 work-queue API status param (UX-BKG-43a). */
export const BOOKINGS_WORK_QUEUE_STATUSES = ["pending", "waitlisted"] as const;

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
