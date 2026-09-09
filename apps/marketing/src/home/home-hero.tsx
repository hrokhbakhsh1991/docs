import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

export type HomeHeroCopyOverride = {
  readonly lead: string;
  readonly support: string;
  readonly ctaPrimary: string;
};

export type HomeHeroProps = {
  readonly heroImageUrl: string;
  readonly heroImageMobileUrl?: string;
  readonly heroImageWidth?: number;
  readonly heroImageHeight?: number;
  readonly copyOverride?: HomeHeroCopyOverride | null;
};

export async function HomeHero({
  heroImageUrl,
  heroImageMobileUrl,
  heroImageWidth,
  heroImageHeight,
  copyOverride = null,
}: HomeHeroProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const mobileSrc = heroImageMobileUrl?.trim() || heroImageUrl;

  return (
    <section data-marketing-home-hero data-marketing-home-hero-walk>
      <picture data-marketing-home-hero-media>
        <source media="(max-width: 48rem)" srcSet={mobileSrc} />
        <img
          src={heroImageUrl}
          alt={t("home.full.hero.imageAlt")}
          width={heroImageWidth}
          height={heroImageHeight}
          fetchPriority="high"
          decoding="async"
          data-marketing-home-hero-background
        />
      </picture>
      <div data-marketing-home-hero-layout>
        <div data-marketing-home-hero-copy>
          <h1 data-marketing-home-title>
            {copyOverride?.lead?.trim() || t("home.full.hero.lead")}
          </h1>
          <p data-marketing-home-hero-support>
            {copyOverride?.support?.trim() || t("home.full.hero.support")}
          </p>
          <Link href={toursHref} data-marketing-home-cta>
            {copyOverride?.ctaPrimary?.trim() || t("home.full.hero.ctaPrimary")}
          </Link>
        </div>
      </div>
    </section>
  );
}
