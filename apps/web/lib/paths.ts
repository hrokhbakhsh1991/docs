/**
 * Public marketing site routes (Next.js App Router).
 * Pure path builders — safe to import from Client Components (no server actions).
 */

export const PUBLIC_CATALOG_LIST_PATH = "/catalog";

export function publicCatalogDetailPath(tourId: string): string {
  return `${PUBLIC_CATALOG_LIST_PATH}/${encodeURIComponent(tourId.trim())}`;
}

export function publicCatalogRegisterPath(tourId: string): string {
  return `${publicCatalogDetailPath(tourId)}/register`;
}
