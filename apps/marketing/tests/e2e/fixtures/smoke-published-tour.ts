/** Smoke catalog tour ids per dev tenant (GX-2). */
export const OPERATOR_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
export const DENALI_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";

export const SMOKE_PUBLISHED_TOUR_TITLE = "North Ridge Trek";

/** Resolve published tour id from smoke base URL or env override. */
export function resolveSmokePublishedTourId(baseUrl?: string): string {
  const override = process.env.SMOKE_PUBLISHED_TOUR_ID?.trim();
  if (override !== undefined && override.length > 0) {
    return override;
  }
  const url = (baseUrl ?? process.env.SMOKE_MARKETING_BASE_URL ?? "http://denali.localhost:3002").toLowerCase();
  if (url.includes("denali.localhost") || url.includes("denali.club")) {
    return DENALI_SMOKE_PUBLISHED_TOUR_ID;
  }
  return OPERATOR_SMOKE_PUBLISHED_TOUR_ID;
}
