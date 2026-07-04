import type { GuestLandingFeatures } from "@app-tour/workspace-sdk";

/** Max catalog rows needed for home discovery blocks (§3.4 / PR-7). */
export function resolveHomeCatalogFetchLimit(landing: GuestLandingFeatures): number {
  const { sections } = landing;
  let limit = 0;

  if (sections.latestTours && sections.latestToursLimit > 0) {
    limit = Math.max(limit, sections.latestToursLimit);
  }
  if (sections.featuredTours && sections.featuredToursLimit > 0) {
    limit = Math.max(limit, sections.featuredToursLimit);
  }
  if (sections.categories) {
    limit = Math.max(limit, 12);
  }
  if (sections.gallery) {
    limit = Math.max(limit, 6);
  }

  return limit;
}

export function shouldFetchHomeCatalog(landing: GuestLandingFeatures): boolean {
  return resolveHomeCatalogFetchLimit(landing) > 0;
}
