import { scheduleMarketingCatalogRevalidate } from "./schedule-marketing-catalog-revalidate";

/**
 * Fire-and-forget marketing surface cache purge after MKP publish (M11).
 * Reuses catalog revalidate endpoint; route also purges `marketing-pages-{tenantId}` tag.
 */
export function scheduleMarketingPagesRevalidate(tenantId: string): void {
  scheduleMarketingCatalogRevalidate(tenantId);
}
