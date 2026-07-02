/**
 * Guest BFF API base — shared by apps/marketing and apps/portal.
 * Production requires explicit TOUR_OPS_API_URL (G-ENV-04).
 */
export function resolveTourOpsApiBaseUrl(): string {
  const explicit =
    process.env.API_INTERNAL_URL?.trim() ||
    process.env.TOUR_OPS_API_URL?.trim() ||
    process.env.API_BASE_URL?.trim();
  if (explicit !== undefined && explicit.length > 0) {
    return explicit.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV?.trim().toLowerCase() === "development") {
    const port = process.env.API_PORT?.trim() || "3001";
    return `http://127.0.0.1:${port}`;
  }
  throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
}

/** Fail-fast in production BFF — G-ENV-04 (P8-2-N-004). */
export function assertGuestBffProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  const url = process.env.TOUR_OPS_API_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
  }
  const publicKey = process.env.AUTH_JWT_PUBLIC_KEY?.trim();
  if (publicKey === undefined || publicKey.length === 0) {
    throw new Error("AUTH_JWT_PUBLIC_KEY_NOT_CONFIGURED");
  }
}
