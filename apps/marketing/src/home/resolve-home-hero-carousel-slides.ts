import { DEFAULT_MARKETING_HERO_IMAGE_PATH } from "@/tenant/resolve-marketing-hero-image-url";

/** Plain outdoor slides for hero carousel — no baked-in text (PR-24). */
export const MARKETING_HERO_CAROUSEL_SLIDES = [
  DEFAULT_MARKETING_HERO_IMAGE_PATH,
  "/home/destinations/damavand.webp",
  "/home/destinations/alborz.webp",
  "/home/destinations/zardkooh.webp",
] as const;

const MAX_HERO_CAROUSEL_SLIDES = 4;

/** Deduped slide list; branding override wins as first frame when set. */
export function resolveHomeHeroCarouselSlides(heroImageUrl: string): readonly string[] {
  const normalized = heroImageUrl.trim();
  const base = [...MARKETING_HERO_CAROUSEL_SLIDES];
  const ordered =
    normalized.length > 0 && normalized !== base[0]
      ? [normalized, ...base.filter((src) => src !== normalized)]
      : base;
  return ordered.slice(0, MAX_HERO_CAROUSEL_SLIDES);
}
