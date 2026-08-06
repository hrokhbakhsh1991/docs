import type { TourThemeResource } from "./catalog-types";
import { fetchDenaliCatalogJsonWithSoftRetry } from "./catalog-soft-fail";

/** Operator tour themes catalog for wizard rule eval context. */
export async function loadDenaliThemeCatalog(): Promise<readonly TourThemeResource[]> {
  try {
    const payload = await fetchDenaliCatalogJsonWithSoftRetry<{
      items?: readonly TourThemeResource[];
    }>("/api/settings/resources/tour_themes", "TOUR_THEMES");
    return payload.items ?? [];
  } catch {
    return [];
  }
}
