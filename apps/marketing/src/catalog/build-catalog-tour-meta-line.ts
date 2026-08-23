import type { MarketingCatalogCard } from "./catalog-types";
import { formatCatalogCardDates, formatCatalogCardSubtitle } from "./format-catalog-display";

export type BuildCatalogTourMetaLineOptions = {
  /** Localized category — avoids raw slug from `listSubtitle`. */
  readonly categoryLabel?: string | null;
};

/** Shared subtitle + date line for list cards and detail header meta. */
export function buildCatalogTourMetaLine(
  tour: MarketingCatalogCard,
  dateLocale: string,
  datesTbaLabel: string,
  options?: BuildCatalogTourMetaLineOptions
): string {
  const categoryLabel = options?.categoryLabel?.trim();
  const subtitle =
    categoryLabel != null && categoryLabel.length > 0
      ? categoryLabel
      : (() => {
          const normalized = formatCatalogCardSubtitle(tour);
          return normalized !== "—" ? normalized : "";
        })();
  const dates = formatCatalogCardDates(tour, dateLocale, datesTbaLabel);
  return [subtitle, dates].filter((part) => part.length > 0).join(" · ");
}
