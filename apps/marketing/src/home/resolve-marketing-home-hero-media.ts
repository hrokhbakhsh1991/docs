import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding";

/** Damavand reference stills — native pixel size, not upscaled. */
export const MARKETING_HOME_HERO_DESKTOP_PATH = "/home/damavand-reference.jpg";
export const MARKETING_HOME_HERO_MOBILE_PATH = "/home/damavand-reference-mobile.jpg";

export const MARKETING_HOME_HERO_DESKTOP_SIZE = {
  width: 1600,
  height: 1067,
} as const;

export const MARKETING_HOME_HERO_MOBILE_SIZE = {
  width: 1024,
  height: 1536,
} as const;

export type MarketingHomeHeroMedia = Readonly<{
  readonly desktopSrc: string;
  readonly mobileSrc: string;
  readonly desktopWidth?: number;
  readonly desktopHeight?: number;
  readonly mobileWidth?: number;
  readonly mobileHeight?: number;
}>;

/**
 * Home Hero sources. Markup stays a `<picture>` with desktop + optional mobile.
 * Tenant `marketingHeroUrl` replaces both slots until a dedicated mobile field exists.
 */
export function resolveMarketingHomeHeroMedia(
  branding: PublicTenantBrandingSnapshot
): MarketingHomeHeroMedia {
  const override = branding.marketingHeroUrl?.trim();
  if (override != null && override.length > 0) {
    return {
      desktopSrc: override,
      mobileSrc: override,
    };
  }

  return {
    desktopSrc: MARKETING_HOME_HERO_DESKTOP_PATH,
    mobileSrc: MARKETING_HOME_HERO_MOBILE_PATH,
    desktopWidth: MARKETING_HOME_HERO_DESKTOP_SIZE.width,
    desktopHeight: MARKETING_HOME_HERO_DESKTOP_SIZE.height,
    mobileWidth: MARKETING_HOME_HERO_MOBILE_SIZE.width,
    mobileHeight: MARKETING_HOME_HERO_MOBILE_SIZE.height,
  };
}
