import { WORKSPACE_REGISTRATION_FOR_TOUR_API_PATHS } from "./workspace-catalog-registration-for-tour-paths.generated";

/**
 * Manifest-derived `{registrationApiPath}/for-tour/{tourId}` for marketing SSR.
 * Returns null when the workspace has no for-tour HTTP route (fail-soft).
 * Does **not** require a live intake plugin registry — unlike
 * `resolveCatalogRegistrationApiPath`.
 */
export function tryResolveCatalogRegistrationForTourApiPath(
  pluginId: string,
  tourId: string
): string | null {
  const base = WORKSPACE_REGISTRATION_FOR_TOUR_API_PATHS[pluginId];
  if (base === undefined) {
    return null;
  }
  const id = tourId.trim();
  if (id.length === 0) {
    return null;
  }
  return `${base}/for-tour/${encodeURIComponent(id)}`;
}
