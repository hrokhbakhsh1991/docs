import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber, toLocalizedDigits } from "@/i18n/format-localized-digits";
import { OPERATOR_DISPLAY_TIME_ZONE } from "@/i18n/datetime-format";
import {
  formatRegistrationIntakeTransportLabel,
  parseRegistrationIntakeRecord,
} from "@app-tour/workspace-sdk";

import {
  BOOKING_STATUS_FILTER_OPTIONS,
  BOOKINGS_LIST_PAGE_SIZE,
  BOOKINGS_LIST_SORT_OPTIONS,
  BOOKINGS_WORK_QUEUE_STATUSES,
  BULK_APPROVE_MAX_BATCH,
  DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
  PAYMENT_STATUS_FILTER_OPTIONS,
  type BookingListItem,
  type BookingStatus,
  type BookingsCommandCenterQuery,
  type BookingsListResponse,
  type BookingsListSort,
  type BookingsListView,
} from "./bookings-command-center-types";

const BOOKING_DATE_LOCALE: Record<AppLocale, string> = {
  fa: "fa-IR",
  en: "en-US",
};

export function readBookingPaymentDueAt(
  item: Pick<BookingListItem, "paymentDueAt">
): string | undefined {
  return typeof item.paymentDueAt === "string" && item.paymentDueAt.length > 0
    ? item.paymentDueAt
    : undefined;
}

export function resolveBookingActionablePaymentDueAt(
  item: Pick<BookingListItem, "paymentDueAt" | "paymentStatus" | "financialDisplayState">
): string | undefined {
  if (item.financialDisplayState === "WAIVED" || item.paymentStatus === "paid") {
    return undefined;
  }
  return readBookingPaymentDueAt(item);
}

export function buildBookingsDetailDeepLinkHref(bookingId: string): string {
  const id = bookingId.trim();
  // status=all so deep links are not masked by the L1 work-queue default.
  return `/bookings?status=all&bookingId=${encodeURIComponent(id)}`;
}

export function readBookingIdFromCommandCenterParams(params: URLSearchParams): string {
  return params.get("bookingId")?.trim() ?? "";
}

function parseCommandCenterStatusParam(statusRaw: string | null): BookingStatus {
  if (statusRaw === null || statusRaw.trim().length === 0) {
    return DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status;
  }
  const trimmed = statusRaw.trim();
  if (trimmed === "actionable") {
    return "actionable";
  }
  const parts = trimmed
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  if (
    parts.length === BOOKINGS_WORK_QUEUE_STATUSES.length &&
    BOOKINGS_WORK_QUEUE_STATUSES.every((value) => parts.includes(value))
  ) {
    return "actionable";
  }
  return (
    BOOKING_STATUS_FILTER_OPTIONS.find((value) => value === trimmed) ??
    DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status
  );
}

export function parseBookingsCommandCenterQuery(
  params: URLSearchParams
): BookingsCommandCenterQuery {
  const viewRaw = params.get("view");
  const view: BookingsListView = viewRaw === "mine" ? "mine" : "ops";
  const status = parseCommandCenterStatusParam(params.get("status"));
  const paymentStatusRaw = params.get("paymentStatus");
  const paymentStatus =
    PAYMENT_STATUS_FILTER_OPTIONS.find((value) => value === paymentStatusRaw) ??
    DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus;
  const sortRaw = params.get("sort");
  const sort =
    BOOKINGS_LIST_SORT_OPTIONS.find((value) => value === sortRaw) ??
    DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort;
  const departureWithinDaysRaw = params.get("departureWithinDays")?.trim() ?? "";
  const departureWithinDaysNum = Number(departureWithinDaysRaw);
  const departureWithinDays =
    departureWithinDaysRaw.length > 0 &&
    Number.isFinite(departureWithinDaysNum) &&
    departureWithinDaysNum >= 1 &&
    departureWithinDaysNum <= 30
      ? String(Math.floor(departureWithinDaysNum))
      : "";
  const approvedWithinDaysRaw = params.get("approvedWithinDays")?.trim() ?? "";
  const approvedWithinDaysNum = Number(approvedWithinDaysRaw);
  const approvedWithinDays =
    approvedWithinDaysRaw.length > 0 &&
    Number.isFinite(approvedWithinDaysNum) &&
    approvedWithinDaysNum >= 1 &&
    approvedWithinDaysNum <= 30
      ? String(Math.floor(approvedWithinDaysNum))
      : "";
  const tourChipScopeRaw = params.get("tourChipScope")?.trim().toLowerCase() ?? "";
  const tourChipScope = tourChipScopeRaw === "all" ? "all" : "";
  const layoutRaw = params.get("layout")?.trim().toLowerCase() ?? "";
  const layout =
    layoutRaw === "timeline" || layoutRaw === "board" || layoutRaw === "inbox"
      ? layoutRaw
      : DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.layout;
  const pageRaw = Number(params.get("page") ?? "1");
  const page =
    Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.page;
  const listCursor = params.get("listCursor")?.trim() ?? "";

  return {
    view,
    status,
    paymentStatus,
    tourId: params.get("tourId")?.trim() ?? "",
    search: params.get("search")?.trim() ?? "",
    scope: params.get("scope")?.trim() ?? "",
    sort,
    departureWithinDays,
    approvedWithinDays,
    tourChipScope,
    layout,
    page,
    listCursor,
  };
}

export function serializeBookingsCommandCenterQuery(query: BookingsCommandCenterQuery): string {
  const params = new URLSearchParams();
  if (query.view !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.view) {
    params.set("view", query.view);
  }
  if (query.status !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status) {
    params.set("status", query.status);
  }
  if (query.paymentStatus !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus) {
    params.set("paymentStatus", query.paymentStatus);
  }
  if (query.tourId.length > 0) {
    params.set("tourId", query.tourId);
  }
  if (query.search.length > 0) {
    params.set("search", query.search);
  }
  if (query.scope.length > 0) {
    params.set("scope", query.scope);
  }
  if (query.sort !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort) {
    params.set("sort", query.sort);
  }
  if (query.departureWithinDays.length > 0) {
    params.set("departureWithinDays", query.departureWithinDays);
  }
  if (query.approvedWithinDays.length > 0) {
    params.set("approvedWithinDays", query.approvedWithinDays);
  }
  if (query.tourChipScope === "all") {
    params.set("tourChipScope", "all");
  }
  if (query.layout !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.layout) {
    params.set("layout", query.layout);
  }
  if (query.page > 1) {
    params.set("page", String(query.page));
  }
  if (query.listCursor.length > 0) {
    params.set("listCursor", query.listCursor);
  }
  return params.toString();
}

export type BookingsApiQueryOptions = {
  readonly cursor?: string;
  readonly limit?: number;
};

export function buildBookingsApiQuery(
  query: BookingsCommandCenterQuery,
  options: BookingsApiQueryOptions = {}
): string {
  const params = new URLSearchParams();
  params.set("view", query.view);
  if (query.status === "actionable") {
    params.set("status", BOOKINGS_WORK_QUEUE_STATUSES.join(","));
  } else if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.paymentStatus !== "all") {
    params.set("paymentStatus", query.paymentStatus);
  }
  if (query.tourId.length > 0) {
    params.set("tourId", query.tourId);
  }
  if (query.search.length > 0) {
    params.set("q", query.search);
  }
  if (query.departureWithinDays.length > 0) {
    params.set("departureWithinDays", query.departureWithinDays);
  }
  if (query.approvedWithinDays.length > 0) {
    params.set("approvedWithinDays", query.approvedWithinDays);
  }
  if (query.sort !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort) {
    params.set("sort", query.sort);
  }
  const cursor = options.cursor?.trim() ?? "";
  if (cursor.length > 0) {
    params.set("cursor", cursor);
  }
  if (options.limit !== undefined && Number.isFinite(options.limit) && options.limit > 0) {
    params.set("limit", String(Math.min(Math.floor(options.limit), 100)));
  }
  return params.toString();
}

export function resolveBookingsListTotalPages(
  total: number,
  pageSize: number = BOOKINGS_LIST_PAGE_SIZE
): number {
  if (!Number.isFinite(total) || total <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(total / pageSize));
}

export function shouldResetBookingsPagination(
  prev: BookingsCommandCenterQuery,
  next: BookingsCommandCenterQuery
): boolean {
  return (
    prev.view !== next.view ||
    prev.status !== next.status ||
    prev.paymentStatus !== next.paymentStatus ||
    prev.tourId !== next.tourId ||
    prev.search !== next.search ||
    prev.scope !== next.scope ||
    prev.sort !== next.sort ||
    prev.departureWithinDays !== next.departureWithinDays ||
    prev.approvedWithinDays !== next.approvedWithinDays ||
    prev.tourChipScope !== next.tourChipScope ||
    prev.layout !== next.layout
  );
}

export function withBookingsPaginationReset(
  query: BookingsCommandCenterQuery
): BookingsCommandCenterQuery {
  return {
    ...query,
    page: 1,
    listCursor: "",
  };
}

export function buildBookingsCommandCenterHref(
  pathname: string,
  query: BookingsCommandCenterQuery,
  bookingId?: string | null
): string {
  const serialized = serializeBookingsCommandCenterQuery(query);
  const params = new URLSearchParams(serialized);
  const id = bookingId?.trim() ?? "";
  if (id.length > 0) {
    params.set("bookingId", id);
  }
  const qs = params.toString();
  return qs.length > 0 ? `${pathname}?${qs}` : pathname;
}

export function mergeBookingsListPages(
  current: BookingsListResponse | null,
  page: BookingsListResponse,
  mode: "replace" | "append"
): BookingsListResponse {
  if (mode === "replace" || current === null) {
    return page;
  }
  const seen = new Set(current.items.map((item) => item.id));
  const appended = page.items.filter((item) => !seen.has(item.id));
  return {
    items: [...current.items, ...appended],
    total: page.total,
    nextCursor: page.nextCursor,
  };
}

export function isTourChipActive(query: BookingsCommandCenterQuery, tourId: string): boolean {
  return query.tourId === tourId;
}

export function toggleTourChipFilter(
  query: BookingsCommandCenterQuery,
  tourId: string
): BookingsCommandCenterQuery {
  if (query.tourId === tourId) {
    return { ...query, tourId: "" };
  }
  return { ...query, tourId };
}

export function isBulkApprovable(item: BookingListItem): boolean {
  return item.status === "pending" || item.status === "waitlisted";
}

/** Kill switch for UX-BKG-48 inline Approve chrome. */
export const BOOKINGS_INLINE_APPROVE_ENABLED = true;

export function canInlineApproveBooking(item: Pick<BookingListItem, "status">): boolean {
  return item.status === "pending" || item.status === "waitlisted";
}

/**
 * Whether to mount the row Approve control (UX-BKG-48).
 * Mobile/narrow: selected row only. No Reject / destructive on row.
 */
export function shouldShowInlineApprove(input: {
  readonly featureEnabled: boolean;
  readonly canManageOps: boolean;
  readonly item: Pick<BookingListItem, "status">;
  readonly selected: boolean;
  readonly narrowViewport: boolean;
}): boolean {
  if (!input.featureEnabled || !input.canManageOps) {
    return false;
  }
  if (!canInlineApproveBooking(input.item)) {
    return false;
  }
  if (input.narrowViewport && !input.selected) {
    return false;
  }
  return true;
}

/** UX-BKG-52 — arm window before inline Approve POSTs. */
export const BOOKINGS_INLINE_APPROVE_ARM_MS = 3_000;

export type InlineApproveClickResult =
  | { readonly kind: "arm"; readonly armedBookingId: string }
  | { readonly kind: "confirm"; readonly bookingId: string };

/**
 * First click arms; second click on the same row confirms (UX-BKG-52).
 * Clicking a different row arms that row instead.
 */
export function resolveInlineApproveClick(input: {
  readonly armedBookingId: string | null;
  readonly clickedBookingId: string;
}): InlineApproveClickResult {
  const clicked = input.clickedBookingId.trim();
  if (clicked.length === 0) {
    return { kind: "arm", armedBookingId: "" };
  }
  if (input.armedBookingId === clicked) {
    return { kind: "confirm", bookingId: clicked };
  }
  return { kind: "arm", armedBookingId: clicked };
}

/** Cooldown between visibility soft-refetches (UX-BKG-49). */
export const BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS = 45_000;

/**
 * Whether returning to a visible tab should soft-refresh the bookings queue.
 * No polling — caller wires `visibilitychange` only.
 */
export function shouldRunBookingsQueueSoftRefresh(input: {
  readonly visibilityState: string;
  readonly nowMs: number;
  readonly lastFetchSucceededAtMs: number | null;
  readonly cooldownMs?: number;
  readonly actionBusy: boolean;
  readonly loadingMore: boolean;
  readonly dialogOpen: boolean;
}): boolean {
  if (input.visibilityState !== "visible") {
    return false;
  }
  if (input.actionBusy || input.loadingMore || input.dialogOpen) {
    return false;
  }
  const cooldown = input.cooldownMs ?? BOOKINGS_QUEUE_FRESHNESS_COOLDOWN_MS;
  if (input.lastFetchSucceededAtMs === null) {
    return true;
  }
  return input.nowMs - input.lastFetchSucceededAtMs >= cooldown;
}

export const BOOKINGS_ROW_TRANSPORT_LABEL_MAX_CHARS = 24;

export type BookingRowTransportLabels = {
  readonly primary: string;
  readonly personalCar: string;
  readonly noCarDong: string;
  readonly noCarAcquaintance: string;
  readonly occupants: (count: 1 | 2 | 3) => string;
};

/**
 * @deprecated UX-BKG-50 amend — row cue removed; list omits intake.
 * Prefer `formatRegistrationIntakeTransportLabel` on detail/inspection payloads.
 */
export function resolveBookingRowTransportLabel(
  intake: Readonly<Record<string, unknown>> | undefined,
  labels: BookingRowTransportLabels
): string | null {
  if (intake === undefined) {
    return null;
  }
  return formatRegistrationIntakeTransportLabel(parseRegistrationIntakeRecord(intake), labels);
}

export function truncateBookingRowTransportLabel(
  label: string,
  maxChars: number = BOOKINGS_ROW_TRANSPORT_LABEL_MAX_CHARS
): string {
  const trimmed = label.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  if (maxChars <= 1) {
    return "…";
  }
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

export function filterBulkApprovableIds(
  items: readonly BookingListItem[],
  selectedIds: readonly string[],
  maxBatch: number = BULK_APPROVE_MAX_BATCH
): string[] {
  const cap = Number.isFinite(maxBatch) && maxBatch >= 0 ? Math.floor(maxBatch) : 0;
  const itemById = new Map(items.map((item) => [item.id, item]));
  return selectedIds
    .filter((id) => {
      const item = itemById.get(id);
      return item !== undefined && isBulkApprovable(item);
    })
    .slice(0, cap);
}

export type BookingsCommandCenterBodyState =
  | { readonly type: "locked" }
  | { readonly type: "loading" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "empty" }
  | { readonly type: "emptyFiltered" }
  | { readonly type: "emptyUpcoming" }
  | { readonly type: "ready" };

/** Preset Upcoming + Departures KPI default window (UX-BKG-43c / 45). */
export const BOOKINGS_UPCOMING_FACET_DAYS = "7";

/** Chrome-exposed L2 windows only — API still accepts 1..30 via URL (UX-BKG-45). */
export const BOOKINGS_DEPARTURE_WINDOW_DAYS = [7, 14, 30] as const;

export type BookingsDepartureWindowDays = (typeof BOOKINGS_DEPARTURE_WINDOW_DAYS)[number];

export type ApplyDepartureWindowIntent = {
  /** `null` clears L2; otherwise clamp to 1..30. */
  readonly days: number | null;
  /** `portfolio` ⇒ `status=all` when enabling (KPI count membership). Default preserve. */
  readonly membership?: "preserve" | "portfolio";
  /** Preset Upcoming may prefer departure sort; never changes layout. Default preserve. */
  readonly sortHint?: "preserve" | "departureAt";
};

/**
 * Single L2 writer (UX-BKG-43c). Sets/clears `departureWithinDays` only (+ approved mutual exclusion).
 * Does not mutate `layout`.
 */
export function applyDepartureWindow(
  query: BookingsCommandCenterQuery,
  intent: ApplyDepartureWindowIntent
): BookingsCommandCenterQuery {
  const membership = intent.membership ?? "preserve";
  const sortHint = intent.sortHint ?? "preserve";

  if (intent.days === null) {
    return { ...query, departureWithinDays: "" };
  }

  const days = Math.floor(intent.days);
  if (!Number.isFinite(days) || days < 1 || days > 30) {
    return query;
  }

  let next: BookingsCommandCenterQuery = {
    ...query,
    departureWithinDays: String(days),
    approvedWithinDays: "",
  };

  if (membership === "portfolio") {
    next = { ...next, status: "all" };
  }
  if (sortHint === "departureAt") {
    next = { ...next, sort: "departureAt" };
  }
  return next;
}

export function isBookingsUpcomingFacetActive(query: BookingsCommandCenterQuery): boolean {
  return query.departureWithinDays.length > 0;
}

export function isBookingsDepartureWindowChipActive(
  query: BookingsCommandCenterQuery,
  days: BookingsDepartureWindowDays
): boolean {
  return query.departureWithinDays === String(days);
}

/**
 * Chrome 7/14/30 chip — tap active clears; otherwise set window (UX-BKG-45).
 * Preserves status + layout.
 */
export function applyBookingsDepartureWindowChip(
  query: BookingsCommandCenterQuery,
  days: BookingsDepartureWindowDays
): BookingsCommandCenterQuery {
  if (query.departureWithinDays === String(days)) {
    return applyDepartureWindow(query, { days: null });
  }
  return applyDepartureWindow(query, { days });
}

/** @deprecated Prefer applyBookingsDepartureWindowChip(query, 7). */
export function toggleBookingsUpcomingFacet(
  query: BookingsCommandCenterQuery
): BookingsCommandCenterQuery {
  return applyBookingsDepartureWindowChip(query, 7);
}

/** P4c — summary chip escape hatch (does not change list filters). */
export function toggleBookingsTourChipScopeAll(
  query: BookingsCommandCenterQuery
): BookingsCommandCenterQuery {
  return {
    ...query,
    tourChipScope: query.tourChipScope === "all" ? "" : "all",
  };
}

export function buildBookingsSummaryApiQuery(query: BookingsCommandCenterQuery): string {
  if (query.tourChipScope === "all") {
    return "tourChipScope=all";
  }
  return "";
}

export function isBookingDepartureOverdue(
  item: Pick<BookingListItem, "departureAt" | "status">,
  now: Date = new Date()
): boolean {
  return resolveBookingDepartureUrgency(item, now) === "overdue";
}

/** Shared 48h threshold for Soon badge + Aging floor (UX-BKG-47). */
export const BOOKINGS_URGENCY_WINDOW_MS = 48 * 60 * 60 * 1000;

export type BookingDepartureUrgency = "overdue" | "soon" | "none";

export type BookingRowUrgencySlot = "overdue" | "soon" | "aging" | "none";

function isBookingDepartureUrgencyEligible(status: BookingListItem["status"]): boolean {
  return status !== "cancelled" && status !== "rejected";
}

/**
 * Departure time urgency — overdue beats soon. No sort side effects (UX-BKG-47).
 */
export function resolveBookingDepartureUrgency(
  item: Pick<BookingListItem, "departureAt" | "status">,
  now: Date = new Date()
): BookingDepartureUrgency {
  if (!isBookingDepartureUrgencyEligible(item.status)) {
    return "none";
  }
  const departure = new Date(item.departureAt);
  if (Number.isNaN(departure.getTime())) {
    return "none";
  }
  const delta = departure.getTime() - now.getTime();
  if (delta < 0) {
    return "overdue";
  }
  if (delta < BOOKINGS_URGENCY_WINDOW_MS) {
    return "soon";
  }
  return "none";
}

/**
 * Whole days waiting in queue (pending|waitlisted). Null if &lt; 48h or not in queue.
 */
export function resolveBookingPendingAgeDays(
  item: Pick<BookingListItem, "submittedAt" | "status">,
  now: Date = new Date()
): number | null {
  if (item.status !== "pending" && item.status !== "waitlisted") {
    return null;
  }
  const submitted = new Date(item.submittedAt);
  if (Number.isNaN(submitted.getTime())) {
    return null;
  }
  const ageMs = now.getTime() - submitted.getTime();
  if (ageMs < BOOKINGS_URGENCY_WINDOW_MS) {
    return null;
  }
  return Math.max(1, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
}

/** Single urgency winner: overdue ≻ soon ≻ aging (UX-BKG-47). */
export function resolveBookingRowUrgencySlot(
  item: Pick<BookingListItem, "departureAt" | "submittedAt" | "status">,
  now: Date = new Date()
): BookingRowUrgencySlot {
  const departure = resolveBookingDepartureUrgency(item, now);
  if (departure === "overdue") {
    return "overdue";
  }
  if (departure === "soon") {
    return "soon";
  }
  if (resolveBookingPendingAgeDays(item, now) !== null) {
    return "aging";
  }
  return "none";
}

export function resolveBookingsCommandCenterBodyState(input: {
  readonly canManageOps: boolean;
  readonly view: BookingsListView;
  readonly loading: boolean;
  readonly error: string | null;
  readonly itemsLength: number;
  readonly hasActiveFilters?: boolean;
  /** When empty + departure window filter active → emptyUpcoming (UX-BKG-34). */
  readonly upcomingFacetActive?: boolean;
}): BookingsCommandCenterBodyState {
  if (input.view === "ops" && !input.canManageOps) {
    return { type: "locked" };
  }
  if (input.loading) {
    return { type: "loading" };
  }
  if (input.error !== null) {
    return { type: "error", message: input.error };
  }
  if (input.itemsLength === 0) {
    if (input.upcomingFacetActive === true) {
      return { type: "emptyUpcoming" };
    }
    return { type: input.hasActiveFilters === true ? "emptyFiltered" : "empty" };
  }
  return { type: "ready" };
}

export function buildRejectBookingRequestBody(reason: string): string {
  const trimmed = reason.trim();
  return trimmed.length > 0 ? JSON.stringify({ reason: trimmed }) : JSON.stringify({});
}

export function formatCapacitySnapshotLabel(
  snapshot: BookingListItem["capacitySnapshot"],
  locale: AppLocale
): string | null {
  if (snapshot === undefined) {
    return null;
  }
  const occupied = formatLocalizedNumber(snapshot.occupied, locale);
  if (snapshot.max === null) {
    return occupied;
  }
  return `${occupied}/${formatLocalizedNumber(snapshot.max, locale)}`;
}

export function capacitySnapshotFillPercent(
  snapshot: BookingListItem["capacitySnapshot"]
): number | null {
  if (snapshot === undefined || snapshot.max === null || snapshot.max <= 0) {
    return null;
  }
  return Math.min(100, Math.round((snapshot.occupied / snapshot.max) * 100));
}

export function resolveInboxSelectionAfterKey(
  items: readonly BookingListItem[],
  selectedId: string | null,
  key: "ArrowDown" | "ArrowUp"
): string | null {
  if (items.length === 0) {
    return null;
  }
  const currentIndex = selectedId === null ? -1 : items.findIndex((item) => item.id === selectedId);
  if (key === "ArrowDown") {
    const next = currentIndex < 0 ? 0 : Math.min(items.length - 1, currentIndex + 1);
    return items[next]?.id ?? null;
  }
  const prev = currentIndex <= 0 ? 0 : currentIndex - 1;
  return items[prev]?.id ?? null;
}

export function formatBookingDeparture(value: string, locale: AppLocale = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return toLocalizedDigits(
    date.toLocaleDateString(BOOKING_DATE_LOCALE[locale], {
      timeZone: OPERATOR_DISPLAY_TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    locale
  );
}

export function formatBookingDateTime(value: string, locale: AppLocale = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return toLocalizedDigits(
    date.toLocaleString(BOOKING_DATE_LOCALE[locale], {
      timeZone: OPERATOR_DISPLAY_TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    locale
  );
}

export function sortBookingListItems(
  items: readonly BookingListItem[],
  sort: BookingsListSort
): BookingListItem[] {
  const copy = [...items];
  if (sort === "departureAt") {
    copy.sort((left, right) => {
      const delta = left.departureAt.localeCompare(right.departureAt);
      return delta !== 0 ? delta : left.id.localeCompare(right.id);
    });
    return copy;
  }
  copy.sort((left, right) => {
    const delta = right.submittedAt.localeCompare(left.submittedAt);
    return delta !== 0 ? delta : right.id.localeCompare(left.id);
  });
  return copy;
}

export function truncateBookingId(bookingId: string, visible = 8): string {
  const id = bookingId.trim();
  if (id.length <= visible * 2 + 1) {
    return id;
  }
  return `${id.slice(0, visible)}…${id.slice(-visible)}`;
}

export function findSelectedBooking(
  items: readonly BookingListItem[],
  selectedId: string | null
): BookingListItem | null {
  if (items.length === 0 || selectedId === null) {
    return null;
  }
  return items.find((item) => item.id === selectedId) ?? items[0] ?? null;
}

export function findExactBooking<T extends Pick<BookingListItem, "id">>(
  items: readonly T[],
  selectedId: string | null
): T | null {
  if (selectedId === null) {
    return null;
  }
  return items.find((item) => item.id === selectedId) ?? null;
}

export function resolveBookingsSelectedId({
  bookingIdFromUrl,
  currentSelectedId,
  items,
}: {
  readonly bookingIdFromUrl: string;
  readonly currentSelectedId: string | null;
  readonly items: readonly Pick<BookingListItem, "id">[];
}): string | null {
  const deepLinkedId = bookingIdFromUrl.trim();
  if (deepLinkedId.length > 0) {
    return deepLinkedId;
  }
  if (currentSelectedId !== null && findExactBooking(items, currentSelectedId) !== null) {
    return currentSelectedId;
  }
  return items[0]?.id ?? null;
}

export function isLeaderReviewAlias(scope: string): boolean {
  return scope === "leader";
}

/** Tailwind `lg` breakpoint − 1px — mobile inspection Sheet only below this. */
export const BOOKINGS_MOBILE_INSPECTION_MAX_WIDTH_MQ = "(max-width: 1023px)";

export function matchesBookingsMobileInspectionViewport(
  matches: (query: string) => boolean
): boolean {
  return matches(BOOKINGS_MOBILE_INSPECTION_MAX_WIDTH_MQ);
}

export type BookingsKpiFilterId = "pending" | "approvedToday" | "waitlist" | "departures7d";

/** Maps clickable KPI cards to command-center query patches. */
export function resolveBookingsKpiQueryPatch(
  kpi: BookingsKpiFilterId
): Partial<BookingsCommandCenterQuery> {
  switch (kpi) {
    case "pending":
      return { status: "pending", departureWithinDays: "", approvedWithinDays: "" };
    case "approvedToday":
      return {
        status: "approved",
        departureWithinDays: "",
        approvedWithinDays: "1",
      };
    case "waitlist":
      return { status: "waitlisted", departureWithinDays: "", approvedWithinDays: "" };
    case "departures7d": {
      const next = applyDepartureWindow(DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY, {
        days: Number(BOOKINGS_UPCOMING_FACET_DAYS),
        membership: "portfolio",
      });
      return {
        status: next.status,
        departureWithinDays: next.departureWithinDays,
        approvedWithinDays: next.approvedWithinDays,
      };
    }
    default: {
      const exhaustive: never = kpi;
      return exhaustive;
    }
  }
}

/** @deprecated Prefer resolveBookingsKpiQueryPatch — kept for status-only callers. */
export function resolveBookingsKpiStatusFilter(
  kpi: Exclude<BookingsKpiFilterId, "departures7d">
): BookingsCommandCenterQuery["status"] {
  const patch = resolveBookingsKpiQueryPatch(kpi);
  return patch.status ?? DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status;
}

export function bookingsCommandCenterHasActiveFilters(query: BookingsCommandCenterQuery): boolean {
  return (
    query.status !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.status ||
    query.paymentStatus !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus ||
    query.tourId.length > 0 ||
    query.search.length > 0 ||
    query.sort !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.sort ||
    query.departureWithinDays.length > 0 ||
    query.approvedWithinDays.length > 0 ||
    query.tourChipScope === "all" ||
    query.layout !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.layout
  );
}

/**
 * UX-BKG-53 — advanced Filters panel dirty (not Queues / window / search / tour chip).
 * Drives Filters button badge. Omits `sort`: Focus preset / By-departure Display set
 * `sort=departureAt` without opening Filters.
 */
export function bookingsAdvancedFiltersDirty(query: BookingsCommandCenterQuery): boolean {
  return (
    query.paymentStatus !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.paymentStatus ||
    query.tourChipScope === "all" ||
    query.approvedWithinDays.length > 0
  );
}

export function clearBookingsCommandCenterFilters(
  query: BookingsCommandCenterQuery
): BookingsCommandCenterQuery {
  return {
    ...DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
    view: query.view,
    scope: query.scope,
  };
}

export function listBulkApprovableIds(
  items: readonly BookingListItem[],
  maxBatch: number = BULK_APPROVE_MAX_BATCH
): string[] {
  const cap = Number.isFinite(maxBatch) && maxBatch >= 0 ? Math.floor(maxBatch) : 0;
  return items
    .filter(isBulkApprovable)
    .map((item) => item.id)
    .slice(0, cap);
}

export function isBookingCancellable(item: BookingListItem): boolean {
  return item.status === "pending" || item.status === "waitlisted" || item.status === "approved";
}

export function isBookingWaitlistable(item: BookingListItem): boolean {
  return item.status === "pending";
}

export function parseBulkApproveBookingsResponse(payload: unknown): {
  readonly approvedIds: readonly string[];
  readonly skippedIds: readonly string[];
} {
  if (typeof payload !== "object" || payload === null) {
    return { approvedIds: [], skippedIds: [] };
  }
  const record = payload as Record<string, unknown>;
  const approvedIds = Array.isArray(record.approvedIds)
    ? record.approvedIds.filter((id): id is string => typeof id === "string")
    : [];
  const skippedIds = Array.isArray(record.skippedIds)
    ? record.skippedIds.filter((id): id is string => typeof id === "string")
    : [];
  return { approvedIds, skippedIds };
}

export type BookingLifecycleAction = "approve" | "reject" | "waitlist" | "cancel";

export type BookingActionNoticeModel =
  | { readonly kind: "none" }
  | {
      readonly kind: "lifecycle";
      readonly action: BookingLifecycleAction;
      readonly guestLabel: string;
      readonly paymentStatus?: BookingListItem["paymentStatus"];
      readonly embeddedTourId?: string;
      readonly registrationId?: string;
      readonly historyStatus?: "rejected" | "cancelled";
      readonly showFinanceLink?: boolean;
    };

/** UX-BKG-56 — post-mutation notice payload (presentation in booking-action-notice). */
export function buildBookingLifecycleActionNotice(input: {
  readonly action: BookingLifecycleAction;
  readonly guestLabel: string;
  readonly paymentStatus?: BookingListItem["paymentStatus"];
  readonly embedded?: boolean;
  readonly lockedTourId?: string;
  readonly registrationId?: string;
}): BookingActionNoticeModel {
  const guestLabel = input.guestLabel.trim();
  if (guestLabel.length === 0) {
    return { kind: "none" };
  }
  const tourId = input.embedded === true ? (input.lockedTourId?.trim() ?? "") : "";
  const embeddedTourId = tourId.length > 0 ? tourId : undefined;
  const registrationId = input.registrationId?.trim() || undefined;
  const showFinanceLink =
    input.action === "approve" &&
    embeddedTourId !== undefined &&
    (input.paymentStatus === "unpaid" || input.paymentStatus === "partial");

  return {
    kind: "lifecycle",
    action: input.action,
    guestLabel,
    paymentStatus: input.paymentStatus,
    embeddedTourId,
    registrationId,
    showFinanceLink,
    historyStatus:
      input.action === "reject" ? "rejected" : input.action === "cancel" ? "cancelled" : undefined,
  };
}

export function buildBookingsHistoryHref(input: {
  readonly tourId?: string;
  readonly status: "rejected" | "cancelled";
}): string {
  const params = new URLSearchParams();
  const tourId = input.tourId?.trim() ?? "";
  if (tourId.length > 0) {
    params.set("tourId", tourId);
  }
  params.set("status", input.status);
  params.set("view", "ops");
  return `/bookings?${params.toString()}`;
}
