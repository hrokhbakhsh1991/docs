import { isDevGuestHostAllowed } from "./is-dev-guest-host-allowed";
import { isLocalhostIngressHost } from "./is-localhost-ingress-host";
import { PHASE_43_HOST_TENANT_IDS } from "./phase-43-host-tenant-ids";
import { resolveTenantIdFromDevHost } from "./resolve-tenant-id-from-dev-host";

const LOCALHOST_PAIRED_HOST_SUFFIXES = [".localhost", ".portal.localhost"] as const;

function resolveClubLabelsForTenantId(tenantId: string): readonly string[] {
  const normalized = tenantId.trim();
  if (normalized.length === 0) {
    return [];
  }
  return Object.entries(PHASE_43_HOST_TENANT_IDS)
    .filter(([, id]) => id.trim() === normalized)
    .map(([label]) => label.trim().toLowerCase())
    .filter((label) => label.length > 0);
}

/**
 * PCMS-03-DEV — bind member session tenant to marketing bootstrap or paired M+P dev hosts.
 * Production callers must still fail-closed via isDevGuestHostAllowed() on the widened branch.
 */
export function sessionTenantMatchesDevCrossSurfaceHost(
  sessionTenantId: string,
  host: string,
  bootstrapTenantId: string
): boolean {
  const normalized = sessionTenantId.trim();
  if (normalized.length === 0) {
    return false;
  }
  if (normalized === bootstrapTenantId.trim()) {
    return true;
  }

  for (const surface of ["marketing", "portal"] as const) {
    const hostTenantId = resolveTenantIdFromDevHost(host, surface);
    if (hostTenantId !== null && normalized === hostTenantId.trim()) {
      return true;
    }
  }

  if (!isDevGuestHostAllowed() || !isLocalhostIngressHost(host)) {
    return false;
  }

  for (const club of resolveClubLabelsForTenantId(normalized)) {
    for (const suffix of LOCALHOST_PAIRED_HOST_SUFFIXES) {
      const pairedHost = `${club}${suffix}`;
      for (const surface of ["marketing", "portal"] as const) {
        const pairedTenantId = resolveTenantIdFromDevHost(pairedHost, surface);
        if (pairedTenantId !== null && normalized === pairedTenantId.trim()) {
          return true;
        }
      }
    }
  }

  return false;
}
