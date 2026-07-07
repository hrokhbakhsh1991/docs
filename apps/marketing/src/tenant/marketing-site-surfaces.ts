export type MarketingSiteSurfaces = {
  readonly admin: boolean;
  readonly marketing: boolean;
  readonly portal: boolean;
};

export const DEFAULT_MARKETING_SITE_SURFACES: MarketingSiteSurfaces = {
  admin: true,
  marketing: true,
  portal: true,
};

export function normalizeMarketingSiteSurfaces(payload: unknown): MarketingSiteSurfaces {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return DEFAULT_MARKETING_SITE_SURFACES;
  }

  const record = payload as Record<string, unknown>;
  return {
    admin: true,
    marketing: record.marketing === false ? false : true,
    portal: record.portal === false ? false : true,
  };
}

export function resolveDevMarketingSiteSurfaces(): MarketingSiteSurfaces {
  const override = process.env.TOUR_OPS_DEV_MARKETING_SURFACE?.trim().toLowerCase();
  if (override === "false" || override === "0" || override === "off") {
    return { admin: true, marketing: false, portal: true };
  }
  return DEFAULT_MARKETING_SITE_SURFACES;
}

export function isMarketingSurfaceEnabled(surfaces: MarketingSiteSurfaces): boolean {
  return surfaces.marketing;
}
