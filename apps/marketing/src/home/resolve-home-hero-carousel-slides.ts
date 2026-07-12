import { DEFAULT_MARKETING_HERO_IMAGE_PATH } from "@/tenant/resolve-marketing-hero-image-url";

import { resolveMarketingDestinationImagePath } from "./resolve-marketing-destination-image-path";

const MAX_HERO_CAROUSEL_SLIDES = 4;

/** Deduped slide list from manifest destination slugs; branding override wins as first frame when set. */
export function resolveHomeHeroCarouselSlides(
  heroImageUrl: string,
  destinationSlugs: readonly string[] = [],
  destinationImageStems: Readonly<Record<string, string>> = {}
): readonly string[] {
  const destinationFrames = destinationSlugs.map((slug) =>
    resolveMarketingDestinationImagePath(slug, destinationImageStems)
  );
  const base = [DEFAULT_MARKETING_HERO_IMAGE_PATH, ...destinationFrames];
  const normalized = heroImageUrl.trim();
  const ordered =
    normalized.length > 0 && normalized !== base[0]
      ? [normalized, ...base.filter((src) => src !== normalized)]
      : base;
  return ordered.slice(0, MAX_HERO_CAROUSEL_SLIDES);
}
