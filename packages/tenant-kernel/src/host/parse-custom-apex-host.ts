import { normalizeRootDomain } from "./parse-workspace-tenant-label";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

export type CustomApexSurface = "marketing_apex" | "portal" | "admin";

export type ParsedCustomApexHost =
  | { readonly matched: false }
  | { readonly matched: true; readonly surface: CustomApexSurface; readonly apex: string };

/**
 * WRS §3.2 — detect customer apex hosts outside platform `{club}.{root}` namespace.
 * Examples: denali.club, portal.denali.club, admin.denali.club
 */
export function tryParseCustomApexHost(
  hostname: string,
  rootDomain: string,
  reservedLabels: Set<string>
): ParsedCustomApexHost {
  const outcome = parseMultiLevelTenantHost(hostname, rootDomain, reservedLabels);
  if (
    outcome.kind === "club_apex" ||
    outcome.kind === "club_admin" ||
    outcome.kind === "club_portal" ||
    outcome.kind === "apex" ||
    outcome.kind === "platform_admin"
  ) {
    return { matched: false };
  }

  if (hostname.startsWith("portal.")) {
    const apex = hostname.slice("portal.".length);
    if (apex.includes(".")) {
      return { matched: true, surface: "portal", apex };
    }
  }

  if (hostname.startsWith("admin.")) {
    const apex = hostname.slice("admin.".length);
    if (apex.includes(".")) {
      return { matched: true, surface: "admin", apex };
    }
  }

  if (hostname.includes(".") && outcome.kind === "outside_workspace") {
    const root = normalizeRootDomain(rootDomain);
    if (root && hostname !== root && !hostname.endsWith(`.${root}`)) {
      return { matched: true, surface: "marketing_apex", apex: hostname };
    }
  }

  return { matched: false };
}

export type FormatCustomApexSurfaceUrlInput = {
  readonly host: string;
  readonly port: string;
  readonly rootDomain: string;
};

/** Dev uses http+port; prod custom apex uses https without port. */
export function formatCustomApexSurfaceUrl(input: FormatCustomApexSurfaceUrlInput): string {
  const host = input.host.trim().toLowerCase();
  const root = normalizeRootDomain(input.rootDomain) || "localhost";
  const isLocalDev = host.endsWith(".localhost") || root === "localhost" || host === "localhost";
  if (isLocalDev) {
    const port = input.port.trim() || "3002";
    return `http://${host}:${port}`;
  }
  return `https://${host}`;
}
