import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogCardDates, formatCatalogCardSubtitle } from "./format-catalog-display";

/** Shared subtitle + date line for list cards and detail header meta. */
export function buildCatalogTourMetaLine(
  tour: MarketingCatalogCard,
  dateLocale: string,
  datesTbaLabel: string
): string {
  const subtitle = formatCatalogCardSubtitle(tour);
  const dates = formatCatalogCardDates(tour, dateLocale, datesTbaLabel);
  return [subtitle, dates].filter((part) => part.length > 0).join(" · ");
}
