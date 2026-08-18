import { getLocale, getTranslations } from "next-intl/server";

import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";

import type { MarketingCatalogCard } from "@/catalog/catalog-types";
import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

import { HomeCategories } from "./home-categories";
import { HomePublishedProgramsCard } from "./home-published-programs-card";
import { HomeSectionViewAllLink } from "./home-section-view-all-link";

export const PUBLISHED_PROGRAMS_MAX = 6;

export type HomePublishedProgramsProps = {
  readonly items: readonly MarketingCatalogCard[];
  readonly pluginId: string;
  readonly showSearch: boolean;
  readonly categories: readonly string[];
};

export async function HomePublishedPrograms({
  items,
  pluginId,
  showSearch,
  categories,
}: HomePublishedProgramsProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const visibleItems = items.slice(0, PUBLISHED_PROGRAMS_MAX);

  return (
    <section data-marketing-home-latest data-marketing-home-programs>
      <div data-marketing-home-programs-inner>
        <header>
          <div data-marketing-home-section-header-row data-marketing-home-programs-header-row>
            <h2>{t("home.full.latest.title")}</h2>
            <HomeSectionViewAllLink data-marketing-home-programs-view-all data-marketing-home-latest-view-all>
              {t("home.full.latest.viewAll")}
            </HomeSectionViewAllLink>
          </div>
          <p data-marketing-home-programs-lead data-marketing-home-latest-lead>
            {t("home.full.latest.lead")}
          </p>
          {showSearch ? (
            <form method="get" action={toursHref} data-marketing-home-search>
              <label htmlFor="home-search-q">{t("home.full.search.label")}</label>
              <div data-marketing-home-programs-search-controls>
                <Input
                  id="home-search-q"
                  name="q"
                  type="search"
                  placeholder={t("home.full.search.placeholder")}
                />
                <Button type="submit">{t("home.full.search.submit")}</Button>
              </div>
            </form>
          ) : null}
          {categories.length > 0 ? <HomeCategories categories={categories} embedded /> : null}
        </header>
        {visibleItems.length > 0 ? (
          <div data-marketing-home-programs-grid data-programs-count={visibleItems.length}>
            {visibleItems.map((tour) => (
              <HomePublishedProgramsCard key={tour.id} tour={tour} pluginId={pluginId} />
            ))}
          </div>
        ) : (
          <p data-marketing-home-programs-empty>{t("list.empty")}</p>
        )}
      </div>
    </section>
  );
}
