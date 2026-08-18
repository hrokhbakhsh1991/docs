import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

import { HomeHeroDestinationStage } from "./hero-static/home-hero-destination-stage";
import { resolveHomeHeroDestinationStories } from "./resolve-home-hero-destination-stories";

export type HomeHeroProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly showSearch: boolean;
  readonly heroImageUrl: string;
  readonly whySectionHref?: string;
  readonly destinationSlugs?: readonly string[];
  readonly destinationImageStems?: Readonly<Record<string, string>>;
};

export async function HomeHero({
  branding,
  showSearch,
  heroImageUrl,
  whySectionHref,
  destinationSlugs = [],
  destinationImageStems = {},
}: HomeHeroProps) {
  void showSearch;
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
  const copy = { siteName };
  const destinationStories = resolveHomeHeroDestinationStories(
    destinationSlugs,
    destinationImageStems
  );
  const stories = destinationStories.map((story) => {
    const name = t(`home.full.destinations.${story.slug}.name`);
    const elevation = t(`home.full.hero.spotlight.${story.slug}.elevationValue`);
    return {
      slug: story.slug,
      src: story.src,
      name,
      elevation,
      caption: elevation ? `${name} · ${elevation}` : name,
    };
  });

  return (
    <section
      data-marketing-home-hero
      data-marketing-home-hero-cinematic
      data-marketing-home-hero-peak-margin
    >
      <HomeHeroDestinationStage
        stories={stories}
        fallbackSrc={heroImageUrl}
        groupLabel={t("home.full.destinations.title")}
      />

      <div data-marketing-home-hero-layout>
        <div data-marketing-home-hero-content>
          <div data-marketing-home-hero-copy>
            <p data-marketing-home-hero-eyebrow>{t("home.full.hero.eyebrow")}</p>
            <h1 data-marketing-home-title>{t("home.full.hero.lead")}</h1>
          </div>
          <div data-marketing-home-hero-actions>
            <Link href={toursHref} data-marketing-home-cta>
              {t("home.full.hero.ctaPrimary")}
            </Link>
            {whySectionHref ? (
              <Link href={whySectionHref} data-marketing-home-cta-secondary>
                {t("home.full.hero.ctaSecondary", copy)}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
