import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
  parseWorkspaceTenantLabelFromHost,
} from "@app-tour/tenant-kernel/host-only";

import { readPublicFallbackHostsFromEnv } from "./read-public-fallback-hosts";

function readRootDomain(): string {
  const fromTenant = process.env.TENANT_ROOT_DOMAIN?.trim();
  if (fromTenant) return fromTenant;
  const fromPlatform = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  if (fromPlatform) return fromPlatform;
  return "localhost";
}

function isBarePublicIngressHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (normalized.length === 0) {
    return false;
  }
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)
  );
}

function hostMatchesPublicFallbackAllowlist(hostname: string): boolean {
  const allowedHosts = readPublicFallbackHostsFromEnv();
  if (allowedHosts.size > 0) {
    return allowedHosts.has(hostname);
  }
  return isBarePublicIngressHost(hostname);
}

/**
 * Sync ingress label for production guest URL builders (mirrors API PUBLIC_TENANT_FALLBACK_*).
 * Used when host is a bare VPS IP or other non-club ingress that still maps to a tenant label.
 */
export function resolveProductionIngressLabelFromHost(host: string): string | null {
  const hostname = host.split(":")[0]?.trim().toLowerCase() ?? "";
  const rootDomain = readRootDomain();
  const reserved = parseReservedLabelsCsv(process.env.TENANT_HOST_RESERVED_LABELS);

  const multiLevel = parseMultiLevelTenantHost(hostname, rootDomain, reserved);
  if (
    multiLevel.kind === "club_admin" ||
    multiLevel.kind === "club_portal" ||
    multiLevel.kind === "club_apex"
  ) {
    return multiLevel.subdomain;
  }

  const apex = parseWorkspaceTenantLabelFromHost(hostname, rootDomain, reserved);
  if (apex.kind === "label") {
    return apex.label;
  }

  const fallbackLabel = process.env.PUBLIC_TENANT_FALLBACK_LABEL?.trim().toLowerCase();
  if (fallbackLabel === undefined || fallbackLabel.length === 0) {
    return null;
  }

  if (!hostMatchesPublicFallbackAllowlist(hostname)) {
    return null;
  }

  return fallbackLabel;
}
