import type { AppLocale } from "@/i18n/routing";
import { formatLocalizedNumber, INTL_LOCALE, toLocalizedDigits } from "@/i18n/format-localized-digits";

import type { TourListProjection } from "./operator-tours-types";

export type TourSeatsFormatLabels = {
  readonly withCapacity: (accepted: number, capacity: number) => string;
  readonly open: (accepted: number) => string;
};

export function formatTourPrice(
  amount: number | null,
  currency: string | null,
  locale: AppLocale = "en"
): string | null {
  if (amount === null) {
    return null;
  }
  const code = currency?.trim().toUpperCase() ?? "USD";
  try {
    return new Intl.NumberFormat(INTL_LOCALE[locale], {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${formatLocalizedNumber(amount, locale)} ${code}`;
  }
}

export function formatTourDeparture(
  iso: string | null,
  locale: AppLocale = "en"
): string | null {
  if (iso === null || iso.trim().length === 0) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatTourSeats(
  tour: Pick<TourListProjection, "acceptedCount" | "totalCapacity">,
  labels?: TourSeatsFormatLabels
): string {
  const accepted = tour.acceptedCount;
  const capacity = tour.totalCapacity;
  if (capacity === null) {
    return labels?.open(accepted) ?? `${accepted} registered`;
  }
  return labels?.withCapacity(accepted, capacity) ?? `${accepted}/${capacity} seats`;
}
