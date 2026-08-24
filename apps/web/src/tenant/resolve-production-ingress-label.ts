import {
  parseMultiLevelTenantHost,
  parseReservedLabelsCsv,
  parseWorkspaceTenantLabelFromHost,
} from "@app-tour/tenant-kernel/host-only";

function readRootDomain(): string {
  const fromTenant = process.env.TENANT_ROOT_DOMAIN?.trim();
  if (fromTenant) return fromTenant;
  const fromPlatform = process.env.PLATFORM_ROOT_DOMAIN?.trim();
  if (fromPlatform) return fromPlatform;
  return "localhost";
}

function isIpv4Host(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isBarePublicIngressHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().split(":")[0] ?? "";
  if (normalized.length === 0) {
    return false;
  }
  return normalized === "localhost" || normalized === "127.0.0.1" || isIpv4Host(normalized);
}

/** Sync ingress label for production session bind (mirrors API PUBLIC_TENANT_FALLBACK_*). */
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

  const allowedHostsRaw = process.env.PUBLIC_TENANT_FALLBACK_HOSTS?.trim();
  if (allowedHostsRaw !== undefined && allowedHostsRaw.length > 0) {
    const allowed = new Set(
      allowedHostsRaw
        .split(",")
        .map((entry) => entry.trim().toLowerCase().split(":")[0] ?? "")
        .filter((entry) => entry.length > 0)
    );
    if (!allowed.has(hostname)) {
      return null;
    }
  } else if (!isBarePublicIngressHost(hostname)) {
    return null;
  }

  return fallbackLabel;
}
