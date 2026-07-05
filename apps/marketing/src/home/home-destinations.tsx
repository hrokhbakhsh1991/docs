import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { HOME_DESTINATION_IDS } from "./home-destination-ids";

function buildDestinationHref(query: string): string {
  const params = new URLSearchParams({ q: query });
  return `/tours?${params.toString()}`;
}

export async function HomeDestinations() {
  const t = await getTranslations("catalog");

  return (
    <section data-marketing-home-destinations id="destinations">
      <header>
        <h2>{t("home.full.destinations.title")}</h2>
        <p>{t("home.full.destinations.lead")}</p>
      </header>
      <div data-marketing-home-destinations-row>
        {HOME_DESTINATION_IDS.map((id) => {
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
                <Link href={buildDestinationHref(name)} data-marketing-home-destination-link>
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
