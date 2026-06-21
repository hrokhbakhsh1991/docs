import { isDevWebSessionAllowed } from "./auth-env";
import { resolveTenantIdFromDevHost } from "./resolve-host-tenant";
import { isOperatorAdminHost, resolveMultiLevelHost } from "./resolve-multi-level-host";

/**
 * Expected tenant for the current Host header.
 * Dev: multi-level `{club}.admin.localhost` + legacy `{label}.localhost`.
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

  const outcome = resolveMultiLevelHost(host);
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    // Provisioned clubs resolve tenant via public registry on BFF login — not static dev map.
    return null;
  }

  const envTenant =
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ??
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim();
  return envTenant !== undefined && envTenant.length > 0 ? envTenant : null;
}

/** True when session JWT tenant matches the workspace host (fail-open when host is unmapped). */
export function sessionTenantMatchesHost(sessionTenantId: string, host: string): boolean {
  const outcome = resolveMultiLevelHost(host);
  if (outcome.kind === "platform_admin") {
    return true;
  }
  if (!isOperatorAdminHost(host)) {
    return true;
  }
  const expected = resolveExpectedTenantIdForHost(host);
  if (expected === null) {
    return true;
  }
  return sessionTenantId.trim() === expected;
}
