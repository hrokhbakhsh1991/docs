import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel/host-only";

import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "./platform-host-env";
import { resolveProductionIngressLabelFromHost } from "./resolve-production-ingress-label";

export function resolveClubSubdomainFromHost(host: string): string | null {
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
    return outcome.subdomain;
  }
  return null;
}

/** Club operator admin host — canonical `{club}.admin.{root}` only (WRS-001). */
export function isOperatorAdminHost(host: string): boolean {
  const outcome = parseMultiLevelTenantHost(
    normalizeHostHeader(host),
    readPlatformRootDomainWeb(),
    readWebReservedHostLabels()
  );
  return outcome.kind === "club_admin";
}

/**
 * Operator admin ingress — canonical club admin host OR Profile B bare IP allowlist
 * (`PUBLIC_TENANT_FALLBACK_*` / `TOUR_OPS_PUBLIC_FALLBACK_HOSTS`).
 */
export function isOperatorAdminIngressHost(host: string): boolean {
  if (isOperatorAdminHost(host)) {
    return true;
  }
  return resolveProductionIngressLabelFromHost(host) !== null;
}
