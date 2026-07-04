import Link from "next/link";
import { getTranslations } from "next-intl/server";

import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";

import { HomeHeroStaticParallax } from "./hero-static/home-hero-static-parallax";

export type HomeHeroProps = {
  readonly branding: PublicTenantBrandingSnapshot;
  readonly showSearch: boolean;
  readonly heroImageUrl: string;
};

export async function HomeHero({ branding, showSearch, heroImageUrl }: HomeHeroProps) {
  const t = await getTranslations("catalog");
  const siteName = branding.displayName ?? t("nav.defaultSiteName");
  const copy = { siteName };

  return (
    <section data-marketing-home-hero data-marketing-home-hero-cinematic>
      <HomeHeroStaticParallax>
        <div data-marketing-home-hero-media aria-hidden="true">
          <img
            src={heroImageUrl}
            alt=""
            data-marketing-home-hero-background
            fetchPriority="high"
            decoding="async"
          />
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
              <Link href="/tours" data-marketing-home-cta>
                {t("home.full.hero.ctaPrimary")}
              </Link>
              <Link href="#why-denali" data-marketing-home-cta-secondary>
                {t("home.full.hero.ctaSecondary", copy)}
              </Link>
            </div>
            {showSearch ? (
              <form method="get" action="/tours" data-marketing-home-search>
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
          <span
            data-marketing-home-hero-scroll-hint
            aria-label={t("home.full.hero.scrollHint")}
          />
        </div>
      </HomeHeroStaticParallax>
    </section>
  );
}
