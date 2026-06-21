import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
  type MultiLevelTenantHostOutcome,
} from "@app-tour/tenant-kernel";

import { readPlatformRootDomain } from "../platform/read-platform-root-domain.ts";

export function normalizeHostHeaderValue(host: string): string {
  return host.split(":")[0]?.trim().toLowerCase() ?? "";
}

export function parseHostHeaderTenantOutcome(host: string): MultiLevelTenantHostOutcome {
  const root = readPlatformRootDomain();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  return parseMultiLevelTenantHost(normalizeHostHeaderValue(host), root, reserved);
}

/**
 * Ingress helper — extract club subdomain from Host when present.
 * JWT / bearer auth remains production tenant SoT.
 */
export function resolveTenantSubdomainFromHostHeader(host: string): string | null {
  const outcome = parseHostHeaderTenantOutcome(host);
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    return outcome.subdomain;
  }
  return null;
}
