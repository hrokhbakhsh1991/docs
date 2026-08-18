import { DEFAULT_TENANT_HOST_RESERVED_LABELS } from "./constants";
import { normalizeRootDomain } from "./parse-workspace-tenant-label";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

function splitHostPort(ingressHost: string): { readonly hostname: string; readonly port: string | null } {
  const trimmed = ingressHost.trim().toLowerCase();
  if (trimmed.length === 0) {
    return { hostname: "", port: null };
  }
  const colon = trimmed.lastIndexOf(":");
  if (colon > 0 && /^\d+$/.test(trimmed.slice(colon + 1))) {
    return { hostname: trimmed.slice(0, colon), port: trimmed.slice(colon + 1) };
  }
  return { hostname: trimmed, port: null };
}

/**
 * WRS-ADMIN-LEGACY-308 / WRS-D-ASYM-01 — localhost only.
 * `{club}.admin.localhost` → `admin.{club}.localhost` (+ port when present).
 * Fail-closed: returns null unless exact legacy shape after parseMultiLevelTenantHost.
 */
export function toCanonicalClubAdminHost(
  ingressHost: string,
  rootDomain: string,
  reservedLabels?: Set<string>
): string | null {
  const root = normalizeRootDomain(rootDomain) || "localhost";
  if (root !== "localhost") {
    return null;
  }

  const { hostname, port } = splitHostPort(ingressHost);
  if (hostname.length === 0) {
    return null;
  }

  const reserved = reservedLabels ?? new Set<string>(DEFAULT_TENANT_HOST_RESERVED_LABELS);
  const outcome = parseMultiLevelTenantHost(hostname, root, reserved);
  if (outcome.kind !== "club_admin") {
    return null;
  }

  const club = outcome.subdomain;
  const legacyExact = `${club}.admin.localhost`;
  const canonicalExact = `admin.${club}.localhost`;

  if (hostname === canonicalExact) {
    return null;
  }
  if (hostname !== legacyExact) {
    return null;
  }

  return port !== null ? `${canonicalExact}:${port}` : canonicalExact;
}

/** True when {@link toCanonicalClubAdminHost} would rewrite this ingress. */
export function isLegacyClubAdminHost(
  ingressHost: string,
  rootDomain: string,
  reservedLabels?: Set<string>
): boolean {
  return toCanonicalClubAdminHost(ingressHost, rootDomain, reservedLabels) !== null;
}
