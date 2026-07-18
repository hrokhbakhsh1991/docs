import { TENANT_SUBDOMAIN_REGEX } from "./constants";
import {
  normalizeRootDomain,
  parseWorkspaceTenantLabelFromHost,
} from "./parse-workspace-tenant-label";

export type MultiLevelTenantHostOutcome =
  | { readonly kind: "no_root_config" }
  | { readonly kind: "outside_workspace" }
  | { readonly kind: "apex" }
  | { readonly kind: "platform_admin" }
  | { readonly kind: "club_admin"; readonly subdomain: string }
  | { readonly kind: "club_portal"; readonly subdomain: string }
  | { readonly kind: "club_apex"; readonly subdomain: string }
  | { readonly kind: "reserved"; readonly label: string }
  | { readonly kind: "invalid_label"; readonly label: string };

function validateClubSubdomain(
  subdomain: string,
  reservedLabels: Set<string>
): Exclude<MultiLevelTenantHostOutcome, { kind: "club_admin" | "club_portal" | "club_apex" }> | null {
  if (reservedLabels.has(subdomain)) {
    return { kind: "reserved", label: subdomain };
  }
  if (!TENANT_SUBDOMAIN_REGEX.test(subdomain)) {
    return { kind: "invalid_label", label: subdomain };
  }
  return null;
}

/**
 * PATTERN-D — multi-level host parser (P1 EPIC E).
 * Order: platform admin → club admin → club portal → single-level club apex.
 */
export function parseMultiLevelTenantHost(
  normalizedHost: string,
  rootDomain: string,
  reservedLabels: Set<string>
): MultiLevelTenantHostOutcome {
  const root = normalizeRootDomain(rootDomain);
  if (!root) {
    return { kind: "no_root_config" };
  }

  const host = normalizedHost.trim().toLowerCase();
  if (host === root) {
    return { kind: "apex" };
  }

  if (host === `admin.${root}`) {
    return { kind: "platform_admin" };
  }

  const adminSuffix = `.admin.${root}`;
  if (host.endsWith(adminSuffix)) {
    const subdomain = host.slice(0, -adminSuffix.length);
    if (!subdomain || subdomain.includes(".")) {
      return { kind: "outside_workspace" };
    }
    const invalid = validateClubSubdomain(subdomain, reservedLabels);
    if (invalid) {
      return invalid;
    }
    return { kind: "club_admin", subdomain };
  }

  const portalSuffix = `.portal.${root}`;
  if (host.endsWith(portalSuffix)) {
    const subdomain = host.slice(0, -portalSuffix.length);
    if (!subdomain || subdomain.includes(".")) {
      return { kind: "outside_workspace" };
    }
    const invalid = validateClubSubdomain(subdomain, reservedLabels);
    if (invalid) {
      return invalid;
    }
    return { kind: "club_portal", subdomain };
  }

  // portal.{club}.{root} — canonical local (PCMS-COOK-03) + prod-shaped platform portal
  const portalPrefix = "portal.";
  const rootSuffix = `.${root}`;
  if (
    host.startsWith(portalPrefix) &&
    host.endsWith(rootSuffix) &&
    host !== `portal.${root}`
  ) {
    const subdomain = host.slice(portalPrefix.length, -rootSuffix.length);
    if (!subdomain || subdomain.includes(".")) {
      return { kind: "outside_workspace" };
    }
    const invalid = validateClubSubdomain(subdomain, reservedLabels);
    if (invalid) {
      return invalid;
    }
    return { kind: "club_portal", subdomain };
  }

  const singleLevel = parseWorkspaceTenantLabelFromHost(host, root, reservedLabels);
  switch (singleLevel.kind) {
    case "label":
      return { kind: "club_apex", subdomain: singleLevel.label };
    case "apex":
      return { kind: "apex" };
    case "no_root_config":
      return { kind: "no_root_config" };
    case "outside_workspace":
      return { kind: "outside_workspace" };
    case "reserved":
      return { kind: "reserved", label: singleLevel.label };
    case "invalid_label":
      return { kind: "invalid_label", label: singleLevel.label };
    default:
      return { kind: "outside_workspace" };
  }
}

export function isPlatformAdminHost(normalizedHost: string, rootDomain: string): boolean {
  return parseMultiLevelTenantHost(normalizedHost, rootDomain, new Set()).kind === "platform_admin";
}

export function isClubAdminHost(
  normalizedHost: string,
  rootDomain: string,
  reservedLabels: Set<string>
): boolean {
  return (
    parseMultiLevelTenantHost(normalizedHost, rootDomain, reservedLabels).kind === "club_admin"
  );
}
