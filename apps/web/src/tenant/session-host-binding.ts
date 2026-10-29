import {
  isTenantSurfaceOriginMapConfigured,
  lookupTenantSurfaceBindingForHost,
} from "@app-tour/guest-surface-host";
import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel/host-only";

import { isDevWebSessionAllowed } from "./auth-env";
import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "./platform-host-env";
import { resolveTenantIdFromDevHost, resolveTenantIdFromIngressLabel } from "./resolve-host-tenant";
import { resolveProductionIngressLabelFromHost } from "./resolve-production-ingress-label";

/**
 * Expected tenant for the current Host header.
 * Staging uses its explicit host map; development uses multi-level
 * `{club}.admin.localhost` (WRS-001); production uses ingress-owned labels.
 * Legacy `{club}.localhost` apex is not an admin host.
 */
export function resolveExpectedTenantIdForHost(host: string): string | null {
  if (isStagingSurfaceMapEnabled()) {
    return lookupTenantSurfaceBindingForHost(host, "admin")?.tenantId ?? null;
  }

  const hostMapped = resolveTenantIdFromDevHost(host);
  if (hostMapped !== null) {
    return hostMapped;
  }

  if (!isDevWebSessionAllowed()) {
    const label = resolveProductionIngressLabelFromHost(host);
    if (label !== null) {
      return resolveTenantIdFromIngressLabel(label);
    }
    return null;
  }

  const outcome = parseMultiLevelTenantHost(
    normalizeHostHeader(host),
    readPlatformRootDomainWeb(),
    readWebReservedHostLabels()
  );
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    // Provisioned clubs resolve tenant via public registry on BFF login — not static dev map.
    return null;
  }

  const envTenant =
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ?? process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim();
  return envTenant !== undefined && envTenant.length > 0 ? envTenant : null;
}

export function shouldFailClosedForTenantHost(): boolean {
  return !isDevWebSessionAllowed() || isStagingSurfaceMapEnabled();
}

function isStagingSurfaceMapEnabled(): boolean {
  return (
    process.env.APP_INFRA_PROFILE?.trim().toLowerCase() === "staging" &&
    isTenantSurfaceOriginMapConfigured()
  );
}

/** True when the session tenant matches static or registry-resolved host context. */
export type SessionTenantHostMatchOptions = {
  /** Tenant resolved from the production host registry. */
  readonly resolvedTenantId?: string | null;
  /** Reject unresolved operator hosts in production. */
  readonly failClosedWhenUnresolved?: boolean;
};

export function sessionTenantMatchesHost(
  sessionTenantId: string,
  host: string,
  options?: SessionTenantHostMatchOptions
): boolean {
  const outcome = parseMultiLevelTenantHost(
    normalizeHostHeader(host),
    readPlatformRootDomainWeb(),
    readWebReservedHostLabels()
  );
  if (outcome.kind === "platform_admin") {
    return true;
  }

  const resolvedTenantId = options?.resolvedTenantId?.trim();
  if (resolvedTenantId !== undefined && resolvedTenantId.length > 0) {
    return sessionTenantId.trim() === resolvedTenantId;
  }

  const expected = resolveExpectedTenantIdForHost(host);
  if (expected !== null) {
    return sessionTenantId.trim() === expected;
  }

  const failClosedWhenUnresolved =
    options?.failClosedWhenUnresolved ?? shouldFailClosedForTenantHost();
  return !failClosedWhenUnresolved;
}
