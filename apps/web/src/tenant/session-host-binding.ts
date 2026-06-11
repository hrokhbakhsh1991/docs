import { isDevWebSessionAllowed } from "./auth-env";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";

/**
 * Expected tenant for the current Host header.
 * Dev: `{label}.localhost` map, else `TOUR_OPS_DEV_TENANT_ID` fallback.
 * Production: host label resolution is ingress-owned — returns null (skip bind).
 */
export function resolveExpectedTenantIdForHost(host: string): string | null {
  const hostMapped = resolveTenantIdFromDevHost(host);
  if (hostMapped !== null) {
    return hostMapped;
  }
  if (!isDevWebSessionAllowed()) {
    return null;
  }
  const envTenant =
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ??
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim();
  return envTenant !== undefined && envTenant.length > 0 ? envTenant : null;
}

/** True when session JWT tenant matches the workspace host (fail-open when host is unmapped). */
export function sessionTenantMatchesHost(sessionTenantId: string, host: string): boolean {
  const expected = resolveExpectedTenantIdForHost(host);
  if (expected === null) {
    return true;
  }
  return sessionTenantId.trim() === expected;
}
