import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingToursListPath, type AppLocale } from "@/i18n/routing";

export type HomeDestinationsProps = {
  readonly destinationSlugs: readonly string[];
};

export async function HomeDestinations({ destinationSlugs }: HomeDestinationsProps) {
  if (destinationSlugs.length === 0) {
    return null;
  }

  const t = await getTranslations("catalog");
  const localeRaw = await getLocale();
  const locale: AppLocale = isAppLocale(localeRaw) ? localeRaw : "fa";

  return (
    <section data-marketing-home-destinations id="destinations">
      <header>
        <h2>{t("home.full.destinations.title")}</h2>
        <p>{t("home.full.destinations.lead")}</p>
      </header>
      <div data-marketing-home-destinations-row>
        {destinationSlugs.map((id) => {
          const name = t(`home.full.destinations.${id}.name`);
          const tagline = t(`home.full.hero.spotlight.${id}.tagline`);
          const elevation = t(`home.full.hero.spotlight.${id}.elevationValue`);
          const region = t(`home.full.hero.spotlight.${id}.regionValue`);

          return (
            <article
              key={id}
              data-marketing-home-destination-card
              data-marketing-home-destination-id={id}
              tabIndex={0}
            >
              <div data-marketing-home-destination-card-body>
                <h3>{name}</h3>
                <p data-marketing-home-destination-tagline>{tagline}</p>
                <p data-marketing-home-destination-description>
                  {t(`home.full.destinations.${id}.description`)}
                </p>
                <p data-marketing-home-destination-meta>
                  <span data-marketing-home-destination-elevation>{elevation}</span>
                  <span data-marketing-home-destination-meta-sep aria-hidden="true">
                    ·
                  </span>
                  <span data-marketing-home-destination-region>{region}</span>
                </p>
                <Link
                  href={resolveMarketingToursListPath(locale, { q: name })}
                  data-marketing-home-destination-link
                >
                  {t("home.full.destinations.explore")}
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
