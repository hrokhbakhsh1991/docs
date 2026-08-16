import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";
import { resolveGuestChromeDisplayName } from "@app-tour/guest-surface-host";
import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";

import { HomeHeroStaticParallax } from "./hero-static/home-hero-static-parallax";
import { HomeHeroCarouselMedia } from "./hero-static/home-hero-carousel-media";
import { resolveHomeHeroCarouselSlides } from "./resolve-home-hero-carousel-slides";

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
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const siteName = resolveGuestChromeDisplayName(branding.displayName, t("nav.defaultSiteName"));
  const copy = { siteName };
  const heroSlides = resolveHomeHeroCarouselSlides(
    heroImageUrl,
    destinationSlugs,
    destinationImageStems
  );

  return (
    <section data-marketing-home-hero data-marketing-home-hero-cinematic>
      <HomeHeroStaticParallax>
        <div data-marketing-home-hero-media aria-hidden="true">
          <HomeHeroCarouselMedia slides={heroSlides} />
          <div data-marketing-home-hero-overlay-scrim />
          <div data-marketing-home-hero-overlay-vignette />
          <div data-marketing-home-hero-overlay-bottom />
          <div data-marketing-home-hero-overlay-atmosphere />
          <div data-marketing-home-hero-overlay-headline-glow />
        </div>

        <div data-marketing-home-hero-layout>
          <div data-marketing-home-hero-content>
            <div data-marketing-home-hero-copy>
              <p data-marketing-home-hero-eyebrow>{t("home.full.hero.eyebrow")}</p>
              <h1 data-marketing-home-title>{siteName}</h1>
              <p data-marketing-home-lead>{t("home.full.hero.lead")}</p>
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
            {showSearch ? (
              <form method="get" action={toursHref} data-marketing-home-search>
                <label htmlFor="home-search-q">{t("home.full.search.label")}</label>
                <Input
                  id="home-search-q"
                  name="q"
                  type="search"
                  placeholder={t("home.full.search.placeholder")}
                />
                <Button type="submit">{t("home.full.search.submit")}</Button>
              </form>
            ) : null}
          </div>
          <span data-marketing-home-hero-scroll-hint aria-label={t("home.full.hero.scrollHint")} />
        </div>
      </HomeHeroStaticParallax>
    </section>
  );
}
