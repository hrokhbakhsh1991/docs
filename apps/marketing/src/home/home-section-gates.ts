import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

export type HomeSectionVisibility = Readonly<{
  readonly hero: boolean;
  readonly heroSearch: boolean;
  readonly featured: boolean;
  readonly latest: boolean;
  readonly categories: boolean;
  readonly destinations: boolean;
  readonly trust: boolean;
  readonly whyDenali: boolean;
  readonly journey: boolean;
  readonly testimonials: boolean;
  readonly gallery: boolean;
  readonly equipment: boolean;
  readonly blogTeaser: boolean;
  readonly faq: boolean;
  readonly finalCta: boolean;
}>;

/** Maps manifest landing gates + catalog payload to renderable home sections. */
export function resolveHomeSectionVisibility(
  landing: GuestLandingFeatures,
  catalogItemsCount: number,
  categoriesCount: number,
  galleryPhotosCount: number
): HomeSectionVisibility {
  const { sections } = landing;

  return {
    hero: sections.hero,
    heroSearch: sections.hero && sections.heroSearch,
    featured:
      sections.featuredTours &&
      sections.featuredToursLimit > 0 &&
      catalogItemsCount > 0,
    latest: sections.latestTours && catalogItemsCount > 0,
    categories: sections.categories && categoriesCount > 0,
    destinations: sections.destinations,
    trust: sections.trust,
    whyDenali: sections.whyDenali,
    journey: sections.journey,
    testimonials: sections.testimonials,
    gallery: sections.gallery && galleryPhotosCount > 0,
    equipment: sections.equipment,
    blogTeaser: sections.blogTeaser,
    faq: sections.faq,
    finalCta: sections.finalCta,
  };
}
