/** Server-only API bridge — mirrors `create-tour.server.ts` (R3). */
export function resolveUrbanApiBaseUrl(): string {
  const url = process.env.TOUR_OPS_API_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
  }
  return url.replace(/\/$/, "");
}

export function buildUrbanPublicTenantHeaders(tenantId: string): Record<string, string> {
  return { "x-tenant-id": tenantId };
}
