import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel";

import { isDevWebSessionAllowed } from "./auth-env";
import { isOperatorAdminHost } from "./operator-admin-host";
import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "./platform-host-env";
import { resolveTenantIdFromDevHost, resolveTenantIdFromIngressLabel } from "./resolve-host-tenant";
import { resolveProductionIngressLabelFromHost } from "./resolve-production-ingress-label";

/**
 * Expected tenant for the current Host header.
 * Dev: multi-level `{club}.admin.localhost` (WRS-001). Legacy `{club}.localhost` apex is not an admin host.
 * Production: host label resolution is ingress-owned — returns null (skip bind).
 */
export function resolveExpectedTenantIdForHost(host: string): string | null {
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
    process.env.TOUR_OPS_DEV_TENANT_ID?.trim() ??
    process.env.NEXT_PUBLIC_DEV_TENANT_ID?.trim();
  return envTenant !== undefined && envTenant.length > 0 ? envTenant : null;
}

/** True when session JWT tenant matches the workspace host (fail-open only for unmapped admin clubs). */
export function sessionTenantMatchesHost(sessionTenantId: string, host: string): boolean {
  const outcome = parseMultiLevelTenantHost(
    normalizeHostHeader(host),
    readPlatformRootDomainWeb(),
    readWebReservedHostLabels()
  );
  if (outcome.kind === "platform_admin") {
    return true;
  }

  const expected = resolveExpectedTenantIdForHost(host);
  if (expected !== null) {
    return sessionTenantId.trim() === expected;
  }

  if (!isOperatorAdminHost(host)) {
    return true;
  }

  return true;
}
