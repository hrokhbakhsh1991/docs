import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
} from "@app-tour/tenant-kernel";

import { resolveTenantFromCustomDomainHost } from "../platform/resolve-tenant-from-custom-domain.ts";
import { resolvePublicTenantLabelFromIngressHost, isBarePublicIngressHost } from "./resolve-public-tenant-label-from-host.ts";

export type PublicIngressSurfaceKind =
  | "club_admin"
  | "club_portal"
  | "club_apex"
  | "custom_domain"
  | "ip_fallback"
  | "unknown";

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

/** Parser surface for ingress host — G-ING-04a (club_admin vs club_portal vs club_apex). */
export function resolvePublicIngressSurfaceKind(host: string): PublicIngressSurfaceKind {
  const rootDomain = readPublicTenantRootDomain();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);
  let normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (normalized.startsWith("shop.")) {
    normalized = normalized.slice("shop.".length);
  }
  const outcome = parseMultiLevelTenantHost(normalized, rootDomain, reserved);
  if (outcome.kind === "club_admin" || outcome.kind === "club_portal" || outcome.kind === "club_apex") {
    return outcome.kind;
  }
  if (!isBarePublicIngressHost(normalized)) {
    return "custom_domain";
  }
  const fallback = resolvePublicTenantLabelFromIngressHost(host);
  if (fallback.kind === "label") {
    return "ip_fallback";
  }
  return "unknown";
}

export async function resolvePublicIngressSubdomain(host: string): Promise<string | null> {
  const sync = resolveSubdomainFromPlatformHost(host);
  if (sync) return sync;
  const normalized = host.split(":")[0]?.trim().toLowerCase() ?? "";
  if (!isBarePublicIngressHost(normalized)) {
    const custom = await resolveTenantFromCustomDomainHost(normalized);
    if (custom?.subdomain) return custom.subdomain;
  }

  const fallback = resolvePublicTenantLabelFromIngressHost(host);
  if (fallback.kind === "label") {
    return fallback.label;
  }
  return null;
}
