import { parseMultiLevelTenantHost } from "@app-tour/tenant-kernel/host";

import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "./platform-host-env";

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
