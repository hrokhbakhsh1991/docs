import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

export type HomeHeroProps = {
  readonly heroImageUrl: string;
  readonly heroImageMobileUrl?: string;
  readonly heroImageMobileSrcSet?: string;
  readonly heroImageWidth?: number;
  readonly heroImageHeight?: number;
  readonly whySectionAnchor?: string;
  readonly consultationHref?: string | null;
  readonly siteName: string;
};

export async function HomeHero({
  heroImageUrl,
  heroImageMobileUrl,
  heroImageMobileSrcSet,
  heroImageWidth,
  heroImageHeight,
  whySectionAnchor = "#why",
  consultationHref = null,
  siteName,
}: HomeHeroProps) {
  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";
  const toursHref = resolveMarketingToursListPath(locale);
  const whyHref = whySectionAnchor.startsWith("#") ? whySectionAnchor : `#${whySectionAnchor}`;
  const secondaryHref = consultationHref ?? whyHref;
  const secondaryLabel = consultationHref
    ? t("home.full.hero.ctaConsultation")
    : t("home.full.hero.ctaSecondary", { siteName });
  const mobileSrc = heroImageMobileUrl?.trim() || heroImageUrl;

  return (
    <section data-marketing-home-hero data-marketing-home-hero-walk>
      <link
        rel="preload"
        as="image"
        href={heroImageUrl}
        media="(min-width: 48.01rem)"
        fetchPriority="high"
      />
      <link
        rel="preload"
        as="image"
        href={mobileSrc}
        imageSrcSet={heroImageMobileSrcSet}
        imageSizes="100vw"
        media="(max-width: 48rem)"
        fetchPriority="high"
      />
      <picture data-marketing-home-hero-media>
        <source
          media="(max-width: 48rem)"
          srcSet={heroImageMobileSrcSet ?? mobileSrc}
          sizes="100vw"
        />
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
          <h1 data-marketing-home-title>{t("home.full.hero.lead")}</h1>
          <p data-marketing-home-hero-support>{t("home.full.hero.support")}</p>
          <Link href={toursHref} prefetch={false} data-marketing-home-cta>
            {t("home.full.hero.ctaPrimary")}
          </Link>
          <Link href={secondaryHref} data-marketing-home-cta-secondary>
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
