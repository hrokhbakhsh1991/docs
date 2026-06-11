import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";

import {
  BOOKING_STATUS_FILTER_OPTIONS,
  BULK_APPROVE_MAX_BATCH,
  DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY,
  PAYMENT_STATUS_FILTER_OPTIONS,
  type BookingListItem,
  type BookingsCommandCenterQuery,
  type BookingsListView,
} from "./bookings-command-center-types";

const BOOKING_DATE_LOCALE: Record<AppLocale, string> = {
  fa: "fa-IR",
  en: "en-US",
};

export function buildBookingsDetailDeepLinkHref(bookingId: string): string {
  const id = bookingId.trim();
  return `/bookings?bookingId=${encodeURIComponent(id)}`;
}

export function readBookingIdFromCommandCenterParams(params: URLSearchParams): string {
  return params.get("bookingId")?.trim() ?? "";
}

export function parseBookingsCommandCenterQuery(
  params: URLSearchParams
): BookingsCommandCenterQuery {
  const viewRaw = params.get("view");
  const view: BookingsListView = viewRaw === "mine" ? "mine" : "ops";
  const statusRaw = params.get("status");
  const status = BOOKING_STATUS_FILTER_OPTIONS.find((value) => value === statusRaw) ?? "all";
  const paymentStatusRaw = params.get("paymentStatus");
  const paymentStatus =
    PAYMENT_STATUS_FILTER_OPTIONS.find((value) => value === paymentStatusRaw) ?? "all";

  return {
    view,
    status,
    paymentStatus,
    tourId: params.get("tourId")?.trim() ?? "",
    search: params.get("search")?.trim() ?? "",
    scope: params.get("scope")?.trim() ?? "",
  };
}

export function serializeBookingsCommandCenterQuery(query: BookingsCommandCenterQuery): string {
  const params = new URLSearchParams();
  if (query.view !== DEFAULT_BOOKINGS_COMMAND_CENTER_QUERY.view) {
    params.set("view", query.view);
  }
  if (query.status !== "all") {
    params.set("status", query.status);
  }
  if (query.paymentStatus !== "all") {
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
  return params.toString();
}

export function buildBookingsApiQuery(query: BookingsCommandCenterQuery): string {
  const params = new URLSearchParams();
  params.set("view", query.view);
  if (query.status !== "all") {
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
  return params.toString();
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

export function filterBulkApprovableIds(
  items: readonly BookingListItem[],
  selectedIds: readonly string[]
): string[] {
  const itemById = new Map(items.map((item) => [item.id, item]));
  return selectedIds
    .filter((id) => {
      const item = itemById.get(id);
      return item !== undefined && isBulkApprovable(item);
    })
    .slice(0, BULK_APPROVE_MAX_BATCH);
}

export type BookingsCommandCenterBodyState =
  | { readonly type: "locked" }
  | { readonly type: "loading" }
  | { readonly type: "error"; readonly message: string }
  | { readonly type: "empty" }
  | { readonly type: "ready" };

export function resolveBookingsCommandCenterBodyState(input: {
  readonly canManageOps: boolean;
  readonly view: BookingsListView;
  readonly loading: boolean;
  readonly error: string | null;
  readonly itemsLength: number;
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
    return { type: "empty" };
  }
  return { type: "ready" };
}

export function formatBookingDeparture(value: string, locale: AppLocale = "en"): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return toLocalizedDigits(
    date.toLocaleDateString(BOOKING_DATE_LOCALE[locale], {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    locale
  );
}

export function findSelectedBooking(
  items: readonly BookingListItem[],
  selectedId: string | null
): BookingListItem | null {
  if (selectedId === null) {
    return items[0] ?? null;
  }
  return items.find((item) => item.id === selectedId) ?? null;
}

export function isLeaderReviewAlias(scope: string): boolean {
  return scope === "leader";
}
