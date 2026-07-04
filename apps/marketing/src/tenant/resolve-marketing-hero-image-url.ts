import type { PublicTenantBrandingSnapshot } from "./fetch-public-tenant-branding";

export const DEFAULT_MARKETING_HERO_IMAGE_PATH = "/home/hero.webp";

/** Per-tenant hero override when branding exposes marketingHeroUrl (PR-8 P9). */
export function resolveMarketingHeroImageUrl(
  branding: PublicTenantBrandingSnapshot
): string {
  const override = branding.marketingHeroUrl?.trim();
  if (override != null && override.length > 0) {
    return override;
  }
  return DEFAULT_MARKETING_HERO_IMAGE_PATH;
}
