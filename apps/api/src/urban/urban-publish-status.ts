import type { Tour } from "../storage/tour-storage.interface";

function tourData(canonical: Tour["canonical"]): Record<string, unknown> | undefined {
  const data = canonical.data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return undefined;
  }
  const tour = data.tour;
  if (tour === null || typeof tour !== "object" || Array.isArray(tour)) {
    return undefined;
  }
  return tour as Record<string, unknown>;
}

/** Published catalog visibility — canonical `publishStatus` or legacy `status`. */
export function isUrbanTourPublished(canonical: Tour["canonical"]): boolean {
  const tour = tourData(canonical);
  if (tour === undefined) {
    return false;
  }
  const publishStatus = tour.publishStatus ?? tour.status;
  return publishStatus === "published";
}

export function toUrbanCatalogCard(tour: Tour) {
  const data = tourData(tour.canonical) ?? {};
  return {
    id: tour.id,
    title: typeof data.title === "string" ? data.title : null,
    city: typeof data.city === "string" ? data.city : null,
    venueName: typeof data.venueName === "string" ? data.venueName : null,
    startDate: typeof data.startDate === "string" ? data.startDate : null,
    endDate: typeof data.endDate === "string" ? data.endDate : null,
    catalogSummary: typeof data.catalogSummary === "string" ? data.catalogSummary : null,
    coverImageUrl: typeof data.coverImageUrl === "string" ? data.coverImageUrl : null,
    publishedAt: typeof data.publishedAt === "string" ? data.publishedAt : null,
    publishStatus: typeof data.publishStatus === "string" ? data.publishStatus : data.status ?? null,
  };
}
