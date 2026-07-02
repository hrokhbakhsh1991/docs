import type { MarketingCatalogCard } from "./catalog-types";

type CatalogPresentationFields = Pick<
  MarketingCatalogCard,
  "listSubtitle" | "listDescription" | "showListPrice" | "priceAmount"
>;

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
  const urbanLine = [card.city, card.venueName]
    .filter((part): part is string => part != null && part.trim().length > 0)
    .join(" · ");
  if (urbanLine.length > 0) {
    return urbanLine;
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

/** Date line — prefers Denali departure/end, falls back to Urban start/end. */
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

export function formatCatalogPrice(
  amount: number | null | undefined,
  currency: string | undefined,
  dateLocale: string,
  priceOnRequestLabel: string
): string {
  if (amount == null) {
    return priceOnRequestLabel;
  }
  return new Intl.NumberFormat(dateLocale, {
    style: "currency",
    currency: currency?.trim() || "IRR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCatalogDateRange(
  departureAt: string | null,
  endAt: string | null,
  dateLocale: string,
  datesTbaLabel: string
): string {
  if (!departureAt) {
    return datesTbaLabel;
  }
  const start = new Date(departureAt);
  if (Number.isNaN(start.getTime())) {
    return datesTbaLabel;
  }
  const startLabel = start.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (!endAt) {
    return startLabel;
  }
  const end = new Date(endAt);
  if (Number.isNaN(end.getTime())) {
    return startLabel;
  }
  const endLabel = end.toLocaleDateString(dateLocale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
}

export function shouldShowCatalogPrice(card: CatalogPresentationFields): boolean {
  if (card.showListPrice === false) {
    return false;
  }
  return card.priceAmount != null;
}
