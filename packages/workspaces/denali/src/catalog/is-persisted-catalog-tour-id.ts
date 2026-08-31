/** Postgres `tours.id` UUID shape — malformed ids fail closed to catalog not-found (B4). */
export const PERSISTED_CATALOG_TOUR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPersistedCatalogTourId(tourId: string): boolean {
  return PERSISTED_CATALOG_TOUR_ID_PATTERN.test(tourId.trim());
}
