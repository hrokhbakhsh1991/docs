import { parseMultiLevelTenantHost, parseReservedLabelsCsv } from "@app-tour/tenant-kernel";

import { readPlatformRootDomainMarketing } from "./read-platform-root-domain";

export function normalizeMarketingHost(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

/** True for platform root: apex or reserved www alias. */
export function isPlatformMotherHost(host: string): boolean {
  const hostname = normalizeMarketingHost(host);
  const root = readPlatformRootDomainMarketing();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, root, reserved);
  if (outcome.kind === "apex") return true;
  if (outcome.kind === "reserved" && outcome.label === "www") return true;
  return false;
}
