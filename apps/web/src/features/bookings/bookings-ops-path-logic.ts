import type { AppLocale } from "@/i18n/routing";
import { toLocalizedDigits } from "@/i18n/format-localized-digits";
import { OPERATOR_DISPLAY_TIME_ZONE } from "@/i18n/datetime-format";

import {
  applyDepartureWindow,
  BOOKINGS_UPCOMING_FACET_DAYS,
} from "./bookings-command-center-logic";
import type {
  BookingListItem,
  BookingsCommandCenterLayout,
  BookingsCommandCenterQuery,
  BookingsOpsPresetId,
} from "./bookings-command-center-types";

const BOOKING_DATE_LOCALE: Record<AppLocale, string> = {
  fa: "fa-IR",
  en: "en-US",
};

export const BOOKINGS_OPS_PRESET_IDS = ["workQueue", "upcoming", "history"] as const;

export function applyBookingsOpsPreset(
  query: BookingsCommandCenterQuery,
  preset: BookingsOpsPresetId
): BookingsCommandCenterQuery {
  switch (preset) {
    case "workQueue": {
      const cleared = applyDepartureWindow(query, { days: null });
      return {
        ...cleared,
        status: "actionable",
        paymentStatus: "all",
        search: "",
        approvedWithinDays: "",
        sort: "submittedAt",
        tourChipScope: "",
        layout: query.layout === "timeline" ? "inbox" : query.layout,
      };
    }
    case "upcoming": {
      // L2 overlay — preserve membership + layout; prefer departure sort (UX-BKG-43c).
      const withWindow = applyDepartureWindow(query, {
        days: Number(BOOKINGS_UPCOMING_FACET_DAYS),
        sortHint: "departureAt",
      });
      return {
        ...withWindow,
        paymentStatus: "all",
        search: "",
      };
    }
    case "history": {
      const cleared = applyDepartureWindow(query, { days: null });
      return {
        ...cleared,
        status: "all",
        paymentStatus: "all",
        search: "",
        approvedWithinDays: "",
        sort: "submittedAt",
        layout: "inbox",
      };
    }
    default: {
      const exhaustive: never = preset;
      return exhaustive;
    }
  }
}

export function resolveActiveBookingsOpsPreset(
  query: BookingsCommandCenterQuery
): BookingsOpsPresetId | null {
  if (
    query.status === "actionable" &&
    query.paymentStatus === "all" &&
    query.departureWithinDays.length === 0 &&
    query.approvedWithinDays.length === 0 &&
    query.sort === "submittedAt" &&
    query.tourChipScope !== "all" &&
    query.search.length === 0
  ) {
    return "workQueue";
  }
  // L2 identity = window on (not gated on sort/layout).
  if (
    query.departureWithinDays === BOOKINGS_UPCOMING_FACET_DAYS &&
    query.search.length === 0
  ) {
    return "upcoming";
  }
  if (
    query.status === "all" &&
    query.departureWithinDays.length === 0 &&
    query.search.length === 0
  ) {
    return "history";
  }
  return null;
}

export function applyBookingsCommandCenterLayout(
  query: BookingsCommandCenterQuery,
  layout: BookingsCommandCenterLayout
): BookingsCommandCenterQuery {
  if (layout === "timeline") {
    return { ...query, layout, sort: "departureAt" };
  }
  // Wire `board` = By Tour grouping only (UX-BKG-44) — no sort/Kanban side effects.
  if (layout === "board") {
    return { ...query, layout };
  }
  return { ...query, layout: "inbox" };
}

export type BookingDepartureDayGroup = {
  readonly dayKey: string;
  readonly label: string;
  readonly items: readonly BookingListItem[];
};

export type BookingTourGroup = {
  readonly tourId: string;
  readonly tourTitle: string;
  readonly items: readonly BookingListItem[];
};

function utcDayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "unknown";
  }
  return date.toISOString().slice(0, 10);
}

export function groupBookingsByDepartureDay(
  items: readonly BookingListItem[],
  locale: AppLocale
): BookingDepartureDayGroup[] {
  const buckets = new Map<string, BookingListItem[]>();
  for (const item of items) {
    const key = utcDayKey(item.departureAt);
    const list = buckets.get(key) ?? [];
    list.push(item);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dayKey, groupItems]) => {
      const sample = groupItems[0]?.departureAt ?? dayKey;
      const date = new Date(sample);
      const label = Number.isNaN(date.getTime())
        ? dayKey
        : toLocalizedDigits(
            date.toLocaleDateString(BOOKING_DATE_LOCALE[locale], {
              timeZone: OPERATOR_DISPLAY_TIME_ZONE,
              weekday: "short",
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
            locale
          );
      return { dayKey, label, items: groupItems };
    });
}

export function groupBookingsByTour(items: readonly BookingListItem[]): BookingTourGroup[] {
  const buckets = new Map<string, BookingTourGroup>();
  for (const item of items) {
    const existing = buckets.get(item.tourId);
    if (existing === undefined) {
      buckets.set(item.tourId, {
        tourId: item.tourId,
        tourTitle: item.tourTitle,
        items: [item],
      });
      continue;
    }
    buckets.set(item.tourId, {
      ...existing,
      items: [...existing.items, item],
    });
  }
  return [...buckets.values()].sort((left, right) =>
    left.tourTitle.localeCompare(right.tourTitle)
  );
}
