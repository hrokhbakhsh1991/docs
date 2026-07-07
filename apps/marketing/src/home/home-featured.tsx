import { getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

import { HomeFeaturedTourCard } from "./home-featured-tour-card";
import { HomeSectionViewAllLink } from "./home-section-view-all-link";

export type HomeFeaturedProps = {
  readonly items: readonly MarketingCatalogCard[];
  readonly pluginId: string;
  readonly branding: PublicTenantBrandingSnapshot;
};

export async function HomeFeatured({ items, pluginId, branding }: HomeFeaturedProps) {
  if (items.length === 0) {
    return null;
  }

  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  const copy = { siteName };
  const [flagship, ...picks] = items;

  return (
    <section data-marketing-home-featured>
      <header>
        <div data-marketing-home-section-header-row data-marketing-home-featured-header-row>
          <h2>{t("home.full.featured.title", copy)}</h2>
          <HomeSectionViewAllLink data-marketing-home-featured-view-all>
            {t("home.full.featured.viewAll")}
          </HomeSectionViewAllLink>
        </div>
        <p data-marketing-home-featured-lead>{t("home.full.featured.lead")}</p>
      </header>
      <div data-marketing-home-featured-bento>
        <HomeFeaturedTourCard
          key={flagship.id}
          tour={flagship}
          pluginId={pluginId}
          featured
          flagshipLabel={t("home.full.featured.flagshipLabel", copy)}
        />
        {picks.length > 0 ? (
          <aside data-marketing-home-featured-picks>
            <p data-marketing-home-featured-picks-label>
              {t("home.full.featured.picksLabel", copy)}
            </p>
            <div data-marketing-home-featured-picks-list>
              {picks.map((tour) => (
                <HomeFeaturedTourCard key={tour.id} tour={tour} pluginId={pluginId} />
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
