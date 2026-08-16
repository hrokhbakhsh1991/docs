import type { AppLocale } from "@/i18n/routing";
import {
  formatDatetimeLocalLabel,
  isoToDatetimeLocalInput,
} from "@/i18n/datetime-format";
import { formatLocalizedNumber, INTL_LOCALE } from "@/i18n/format-localized-digits";

import type { TourListProjection } from "./operator-tours-types";

export type TourSeatsFormatLabels = {
  readonly withCapacity: (accepted: number, capacity: number) => string;
  readonly open: (accepted: number) => string;
};

/** Denali stores toman digits in ISO `IRR`. Other workspaces keep Intl for `IRR`. */
export function operatorIrrUsesTomanLabel(pluginId: string | undefined): boolean {
  return pluginId === "denali";
}

export function formatTourPrice(
  amount: number | null,
  currency: string | null,
  locale: AppLocale = "en",
  pluginId?: string
): string | null {
  if (amount === null) {
    return null;
  }
  const code = currency?.trim().toUpperCase() ?? "USD";
  // ED-CURR-01 — Denali operator amounts are toman; ISO storage stays IRR. Do not ×10.
  if (code === "IRR" && operatorIrrUsesTomanLabel(pluginId)) {
    const unit = locale === "fa" ? "تومان" : "toman";
    return `${formatLocalizedNumber(amount, locale)} ${unit}`;
  }
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
  // Match review: convert ISO-Z to local datetime-local wall before labeling.
  const label = formatDatetimeLocalLabel(isoToDatetimeLocalInput(iso), locale);
  return label.length > 0 ? label : null;
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
