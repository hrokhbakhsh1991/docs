import {
  sessionTenantMatchesDevCrossSurfaceHost,
  resolveTenantIdFromDevHost,
  resolveTenantIdFromIngressLabel,
} from "@app-tour/guest-surface-host";

import { isDevWebSessionAllowed } from "./auth-env";
import { resolveProductionIngressLabelFromHost } from "./resolve-production-ingress-label";

export function resolveExpectedTenantIdForHost(host: string): string | null {
  const hostMapped = resolveTenantIdFromDevHost(host, "portal");
  if (hostMapped !== null) {
    return hostMapped;
  }

  if (!isDevWebSessionAllowed()) {
    const label = resolveProductionIngressLabelFromHost(host);
    if (label !== null) {
      return resolveTenantIdFromIngressLabel(label);
    }
  }

  return null;
}

export function sessionMemberMatchesPortalTenant(
  sessionTenantId: string,
  portalTenantId: string
): boolean {
  return sessionTenantId.trim() === portalTenantId.trim();
}

/**
 * Guest auth surfaces mirror marketing's dev cross-surface session bind so a
 * shared member session can reopen login/register on paired M<->P hosts.
 * Protected `/me/*` and member APIs stay on strict portal tenant checks.
 */
export function sessionMemberMatchesPortalGuestSurface(
  sessionTenantId: string,
  host: string,
  portalTenantId: string
): boolean {
  return sessionTenantMatchesDevCrossSurfaceHost(sessionTenantId, host, portalTenantId);
}

export type SessionTenantHostMatchOptions = {
  /** Fail-closed compare when portal bootstrap resolved tenantId (PCMS-SEC-01). */
  readonly resolvedPortalTenantId?: string | null;
  /** PCMS-SEC-02 — reject session when host tenant cannot be resolved (production). */
  readonly failClosedWhenUnresolved?: boolean;
};

/** True when member JWT tenant matches portal host tenant context. */
export function sessionTenantMatchesHost(
  sessionTenantId: string,
  host: string,
  options?: SessionTenantHostMatchOptions
): boolean {
  const resolved = options?.resolvedPortalTenantId?.trim();
  if (resolved !== undefined && resolved.length > 0) {
    return sessionMemberMatchesPortalTenant(sessionTenantId, resolved);
  }

  const expected = resolveExpectedTenantIdForHost(host);
  if (expected !== null) {
    return sessionMemberMatchesPortalTenant(sessionTenantId, expected);
  }
  if (options?.failClosedWhenUnresolved === true) {
    return false;
  }
  return true;
}
