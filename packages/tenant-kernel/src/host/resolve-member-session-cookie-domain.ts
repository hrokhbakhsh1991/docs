import { DEFAULT_TENANT_HOST_RESERVED_LABELS } from "./constants";
import { normalizeRootDomain } from "./parse-workspace-tenant-label";
import { tryParseCustomApexHost } from "./parse-custom-apex-host";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

/**
 * PCMS-COOK-01 — optional share-parent for member cookie Domain attribute.
 * - Custom apex: portal.denali.club → Domain=denali.club
 * - Local inverted portal: portal.denali.localhost → Domain=denali.localhost
 * - Legacy {club}.portal.localhost / other platform hosts: undefined (host-only)
 */
export function resolveMemberSessionCookieDomain(
  ingressHost: string,
  rootDomain: string,
  reservedLabels?: Set<string>
): string | undefined {
  const hostname = ingressHost.split(":")[0]?.trim().toLowerCase() ?? "";
  if (hostname.length === 0) {
    return undefined;
  }

  const root = normalizeRootDomain(rootDomain) || "localhost";
  const reserved =
    reservedLabels ?? new Set<string>(DEFAULT_TENANT_HOST_RESERVED_LABELS);

  // PCMS-COOK-03 — portal.{club}.localhost shares with {club}.localhost (Chromium-accepted).
  // Never Domain=.localhost / Domain=localhost (PSL).
  if (root === "localhost") {
    const outcome = parseMultiLevelTenantHost(hostname, root, reserved);
    if (
      outcome.kind === "club_portal" &&
      hostname === `portal.${outcome.subdomain}.localhost`
    ) {
      return `${outcome.subdomain}.localhost`;
    }
  }

  const parsed = tryParseCustomApexHost(hostname, root, reserved);
  if (!parsed.matched) {
    return undefined;
  }

  const apex = parsed.apex.trim().toLowerCase();
  if (apex.length === 0 || apex === "localhost" || apex.endsWith(".localhost")) {
    return undefined;
  }

  return apex;
}
