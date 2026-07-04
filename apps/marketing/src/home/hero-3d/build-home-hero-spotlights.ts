import { MARKETING_DESTINATION_IMAGE_PATHS } from "../home-marketing-assets";
import { HOME_DESTINATION_IDS, type HomeDestinationId } from "../home-destination-ids";
import type { HomeHeroSpotlight } from "./home-hero-spotlight-types";

type CatalogTranslator = (key: string) => string;

function buildToursHref(query: string): string {
  const params = new URLSearchParams({ q: query });
  return `/tours?${params.toString()}`;
}

/** Builds hero spotlight cards from catalog i18n + static assets. */
export function buildHomeHeroSpotlights(t: CatalogTranslator): readonly HomeHeroSpotlight[] {
  return HOME_DESTINATION_IDS.map((id: HomeDestinationId) => {
    const name = t(`home.full.destinations.${id}.name`);
    return {
      id,
      imagePath: MARKETING_DESTINATION_IMAGE_PATHS[id],
      name,
      tagline: t(`home.full.hero.spotlight.${id}.tagline`),
      description: t(`home.full.destinations.${id}.description`),
      elevationLabel: t("home.full.hero.spotlight.stats.elevation"),
      elevationValue: t(`home.full.hero.spotlight.${id}.elevationValue`),
      regionLabel: t("home.full.hero.spotlight.stats.region"),
      regionValue: t(`home.full.hero.spotlight.${id}.regionValue`),
      toursHref: buildToursHref(name),
    };
  });
}

export const DEFAULT_HERO_SPOTLIGHT_ID: HomeDestinationId = "damavand";
