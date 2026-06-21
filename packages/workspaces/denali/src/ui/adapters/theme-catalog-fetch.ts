import type { TourThemeResource } from "./catalog-types";

/** Operator tour themes catalog for wizard rule eval context. */
export async function loadDenaliThemeCatalog(): Promise<readonly TourThemeResource[]> {
  try {
    const response = await fetch("/api/settings/resources/tour_themes", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`TOUR_THEMES_HTTP_${response.status}`);
    }
    const payload = (await response.json()) as { items?: readonly TourThemeResource[] };
    return payload.items ?? [];
  } catch {
    return [];
  }
}
