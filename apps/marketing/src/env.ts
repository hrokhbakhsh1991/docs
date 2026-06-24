/** Server-only API base — same env as admin shell. */
export function resolveTourOpsApiBaseUrl(): string {
  const url = process.env.TOUR_OPS_API_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
  }
  return url.replace(/\/$/, "");
}

/** Fail-fast in production BFF — G-ENV-04 (P8-2-N-004). */
export function assertGuestBffProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  resolveTourOpsApiBaseUrl();
  const publicKey = process.env.AUTH_JWT_PUBLIC_KEY?.trim();
  if (publicKey === undefined || publicKey.length === 0) {
    throw new Error("AUTH_JWT_PUBLIC_KEY_NOT_CONFIGURED");
  }
}
