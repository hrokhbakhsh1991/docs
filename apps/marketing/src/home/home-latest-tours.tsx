import { getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";

import { HomeLatestTourCard } from "./home-latest-tour-card";
import { HomeSectionViewAllLink } from "./home-section-view-all-link";

export type HomeLatestToursProps = {
  readonly items: readonly MarketingCatalogCard[];
  readonly pluginId: string;
};

export async function HomeLatestTours({ items, pluginId }: HomeLatestToursProps) {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-latest>
      <header>
        <div data-marketing-home-section-header-row data-marketing-home-latest-header-row>
          <h2>{t("home.full.latest.title")}</h2>
          <HomeSectionViewAllLink data-marketing-home-latest-view-all>
            {t("home.full.latest.viewAll")}
          </HomeSectionViewAllLink>
        </div>
        <p data-marketing-home-latest-lead>{t("home.full.latest.lead")}</p>
      </header>
      <div data-marketing-home-latest-row>
        {items.map((tour) => (
          <HomeLatestTourCard key={tour.id} tour={tour} pluginId={pluginId} />
        ))}
      </div>
    </section>
  );
}
