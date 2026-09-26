import type { MarketingCatalogCard } from "./catalog-types";
import { CatalogTourCard } from "./catalog-tour-card";
import type { MarketingCommercialPricingPreview } from "./commercial-pricing-preview";
import type { MarketingCommercialPricingPreviewStatus } from "./fetch-commercial-pricing-previews.server";

export type CatalogTourListProps = {
  readonly items: readonly MarketingCatalogCard[];
  readonly pluginId: string;
  readonly pricingPreviews?: Readonly<Record<string, MarketingCommercialPricingPreview>>;
  readonly pricingPreviewStatus?: MarketingCommercialPricingPreviewStatus;
};

export async function CatalogTourList({
  items,
  pluginId,
  pricingPreviews = {},
  pricingPreviewStatus = "anonymous",
}: CatalogTourListProps) {
  return (
    <ul data-marketing-catalog-grid>
      {items.map((tour) => (
        <li key={tour.id} data-marketing-catalog-grid-item>
          <CatalogTourCard
            tour={tour}
            pluginId={pluginId}
            pricingPreview={pricingPreviews[tour.id] ?? null}
            pricingPreviewStatus={pricingPreviewStatus}
          />
        </li>
      ))}
    </ul>
  );
}
