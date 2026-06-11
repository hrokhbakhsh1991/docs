/** Server-only API bridge — reads `TOUR_OPS_API_URL` (all workspaces, not urban-specific). */
export function resolveTourOpsApiBaseUrl(): string {
  const url = process.env.TOUR_OPS_API_URL?.trim();
  if (url === undefined || url.length === 0) {
    throw new Error("TOUR_OPS_API_URL_NOT_CONFIGURED");
  }
  return url.replace(/\/$/, "");
}

/** @deprecated Use `resolveTourOpsApiBaseUrl` — kept for incremental migration. */
export const resolveUrbanApiBaseUrl = resolveTourOpsApiBaseUrl;

export function buildUrbanPublicTenantHeaders(tenantId: string): Record<string, string> {
  return { "x-tenant-id": tenantId };
}
