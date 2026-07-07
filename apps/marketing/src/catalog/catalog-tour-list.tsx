import type { MarketingCatalogCard } from "./catalog-types";
import { CatalogTourCard } from "./catalog-tour-card";

export type CatalogTourListProps = {
  readonly items: readonly MarketingCatalogCard[];
  readonly pluginId: string;
};

export async function CatalogTourList({ items, pluginId }: CatalogTourListProps) {
  return (
    <ul data-marketing-catalog-grid>
      {items.map((tour) => (
        <li key={tour.id} data-marketing-catalog-grid-item>
          <CatalogTourCard tour={tour} pluginId={pluginId} />
        </li>
      ))}
    </ul>
  );
}
