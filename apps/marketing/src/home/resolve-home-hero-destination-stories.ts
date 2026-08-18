import { resolveMarketingDestinationImagePath } from "./resolve-marketing-destination-image-path";

export type HomeHeroDestinationStory = Readonly<{
  readonly slug: string;
  readonly src: string;
}>;

/** Destination stills for the Hero selector. Generic `/home/hero.webp` is a fallback, not a tab. */
export function resolveHomeHeroDestinationStories(
  destinationSlugs: readonly string[] = [],
  destinationImageStems: Readonly<Record<string, string>> = {}
): readonly HomeHeroDestinationStory[] {
  const seen = new Set<string>();
  const stories: HomeHeroDestinationStory[] = [];

  for (const rawSlug of destinationSlugs) {
    const slug = rawSlug.trim();
    if (slug.length === 0 || seen.has(slug)) {
      continue;
    }
    seen.add(slug);
    stories.push({
      slug,
      src: resolveMarketingDestinationImagePath(slug, destinationImageStems),
    });
  }

  return stories;
}
