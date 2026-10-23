import { DEFAULT_TENANT_HOST_RESERVED_LABELS } from "./constants";
import { normalizeRootDomain } from "./parse-workspace-tenant-label";
import { tryParseCustomApexHost } from "./parse-custom-apex-host";
import { parseMultiLevelTenantHost } from "./parse-multi-level-tenant-host";

/**
 * PCMS-COOK-01 — optional share-parent for member cookie Domain attribute.
 * - Canonical platform portal: portal.denali.shenski.com → Domain=denali.shenski.com
 * - Custom apex: portal.denali.club → Domain=denali.club
 * - Local portal hosts: host-only (Chromium does not reliably persist a
 *   parent-domain session cookie beneath the reserved `.localhost` suffix)
 * - Legacy {club}.portal.{root} / other platform hosts: undefined (host-only)
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

  // Keep every local development session host-only. A Domain attribute below
  // `.localhost` is not a portable browser contract; in particular, Chromium
  // can discard it during the first authenticated navigation. Marketing is
  // intentionally anonymous (PCMS), so dev does not need a shared member
  // cookie between local subdomains.
  if (root === "localhost") {
    if (hostname === "localhost" || hostname.endsWith(".localhost")) {
      return undefined;
    }
  }

  // PCMS-COOK-03 — canonical platform portal shares with the workspace apex.
  // The explicit prefix check is required because the parser also accepts the
  // legacy `{club}.portal.{root}` shape, which must remain host-only.
  if (root !== "localhost") {
    const outcome = parseMultiLevelTenantHost(hostname, root, reserved);
    if (
      outcome.kind === "club_portal" &&
      hostname === `portal.${outcome.subdomain}.${root}`
    ) {
      return `${outcome.subdomain}.${root}`;
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
