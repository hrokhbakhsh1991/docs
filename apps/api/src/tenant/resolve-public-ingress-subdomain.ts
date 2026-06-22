import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

import { resolveTenantFromCustomDomainHost } from "../platform/resolve-tenant-from-custom-domain.ts";

function readPublicTenantRootDomain(): string {
  const fromTenant = process.env.TENANT_ROOT_DOMAIN?.trim();
  if (fromTenant) return fromTenant;
  const fromPlatform = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  if (fromPlatform) return fromPlatform;
  return "localhost";
}

export function resolveSubdomainFromPlatformHost(host: string): string | null {
  const rootDomain = readPublicTenantRootDomain();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  let normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("shop.")) {
    normalized = normalized.slice("shop.".length);
  }
  const outcome = parseMultiLevelTenantHost(normalized, rootDomain, reserved);
  if (
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "club_apex"
  ) {
    return outcome.subdomain;
  }
  return null;
}

export async function resolvePublicIngressSubdomain(host: string): Promise<string | null> {
  const sync = resolveSubdomainFromPlatformHost(host);
  if (sync) return sync;
  const normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const custom = await resolveTenantFromCustomDomainHost(normalized);
  return custom?.subdomain ?? null;
}
