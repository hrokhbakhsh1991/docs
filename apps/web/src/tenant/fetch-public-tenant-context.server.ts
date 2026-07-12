import {
  fetchPublicTenantContextForHost as fetchGuestPublicTenantContextForHost,
  resolveGuestBootstrapRevalidateSeconds,
  type PublicTenantContextSnapshot,
} from "@app-tour/guest-surface-host";

export type { PublicTenantContextSnapshot };

function apiBaseUrl(): string {
  return (
    process.env.API_INTERNAL_URL ??
    process.env.TOUR_OPS_API_URL ??
    process.env.API_BASE_URL ??
    `http://127.0.0.1:${process.env.API_PORT ?? "3001"}`
  );
}

/** Server-only — production public catalog bootstrap (guest-safe). */
export async function fetchPublicTenantContextForHost(
  host: string
): Promise<PublicTenantContextSnapshot | null> {
  return fetchGuestPublicTenantContextForHost(host, {
    apiBaseUrl: apiBaseUrl(),
    nextRevalidate: resolveGuestBootstrapRevalidateSeconds(),
  });
}
