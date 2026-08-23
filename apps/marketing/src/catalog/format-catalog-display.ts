import { formatLocalizedNumber } from "@/i18n/format-localized-digits";

import type { MarketingCatalogCard } from "./catalog-types";
import type { MarketingCatalogSurface } from "./marketing-catalog-surface-types";

type CatalogPresentationFields = Pick<
  MarketingCatalogCard,
  "listSubtitle" | "listDescription" | "showListPrice" | "priceAmount"
>;
export type CatalogPriceDisplayPolicy = Pick<MarketingCatalogSurface, "irrDisplayUnit">;

/** Normalized subtitle from egress presentation fields (Track A). */
export function formatCatalogCardSubtitle(card: MarketingCatalogCard): string {
  const normalized = card.listSubtitle?.trim();
  if (normalized !== undefined && normalized.length > 0) {
    return normalized;
  }
  const category = card.category?.trim();
  if (category !== undefined && category.length > 0) {
    return category;
  }
  const locationLine = [card.city, card.venueName]
    .filter((part): part is string => part != null && part.trim().length > 0)
    .join(" · ");
  if (locationLine.length > 0) {
    return locationLine;
  }
  return "—";
}

/** Description line — prefers normalized `listDescription`. */
export function formatCatalogCardDescription(card: MarketingCatalogCard): string | null {
  const text =
    card.listDescription?.trim() ||
    card.shortDescription?.trim() ||
    card.catalogSummary?.trim() ||
    "";
  return text.length > 0 ? text : null;
}

/** Date line — prefers canonical departure/end, then presentation start/end. */
export function formatCatalogCardDates(
  card: MarketingCatalogCard,
  dateLocale: string,
  datesTbaLabel: string
): string {
  if (card.departureAt != null || card.endAt != null) {
    return formatCatalogDateRange(
      card.departureAt ?? null,
      card.endAt ?? null,
      dateLocale,
      datesTbaLabel
    );
  }
  if (card.startDate != null || card.endDate != null) {
    return formatCatalogDateRange(
      card.startDate ?? null,
      card.endDate ?? null,
      dateLocale,
      datesTbaLabel
    );
  }
  return datesTbaLabel;
}

/** Workspace policy owns the display unit; ISO storage stays IRR. */
export function catalogIrrUsesTomanLabel(
  priceDisplayPolicy: CatalogPriceDisplayPolicy | null | undefined
): boolean {
  return priceDisplayPolicy?.irrDisplayUnit === "toman";
}

export function formatCatalogPrice(
  amount: number | null | undefined,
  currency: string | undefined,
  dateLocale: string,
  priceOnRequestLabel: string,
  priceDisplayPolicy?: CatalogPriceDisplayPolicy | null
): string {
  if (amount == null) {
    return priceOnRequestLabel;
  }
  const code = currency?.trim().toUpperCase() ?? "";
  if (code.length === 0) {
    return priceOnRequestLabel;
  }
  const isFa = dateLocale.startsWith("fa");
  // ED-CURR-MKT-01 — some catalog IRR amounts are toman digits; ISO storage stays IRR.
  // Do not ×10. Do not reuse operator formatTourPrice or finance formatters.
  // Do not apply toman unless the workspace-owned marketing surface declares it.
  if (code === "IRR" && catalogIrrUsesTomanLabel(priceDisplayPolicy)) {
    const unit = isFa ? "تومان" : "toman";
    return `${formatLocalizedNumber(amount, isFa ? "fa" : "en", { maximumFractionDigits: 0 })} ${unit}`;
  }
  try {
    return new Intl.NumberFormat(dateLocale, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
      ...(isFa ? { numberingSystem: "arabext" } : {}),
    }).format(amount);
  } catch {
    return `${formatLocalizedNumber(amount, isFa ? "fa" : "en", { maximumFractionDigits: 0 })} ${code}`;
  }
}

export function formatCatalogDateRange(
  departureAt: string | null,
  endAt: string | null,
  dateLocale: string,
  datesTbaLabel: string
): string {
  const formatOptions: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...(dateLocale.startsWith("fa") ? { calendar: "persian", numberingSystem: "arabext" } : {}),
  };

  if (!departureAt) {
    return datesTbaLabel;
  }
  const start = new Date(departureAt);
  if (Number.isNaN(start.getTime())) {
    return datesTbaLabel;
  }
  const startLabel = start.toLocaleDateString(dateLocale, formatOptions);
  if (!endAt) {
    return startLabel;
  }
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) {
    return startLabel;
  }
  const endLabel = end.toLocaleDateString(dateLocale, formatOptions);
  return `${startLabel} – ${endLabel}`;
}

export function shouldShowCatalogPrice(card: CatalogPresentationFields): boolean {
  if (card.showListPrice === false) {
    return false;
  }
  return card.priceAmount != null;
}
