import { DEFAULT_TENANT_HOST_RESERVED_LABELS } from "./constants";
import { normalizeRootDomain } from "./parse-workspace-tenant-label";
import { tryParseCustomApexHost } from "./parse-custom-apex-host";

/**
 * PCMS-COOK-01 — optional registrable apex for member cookie Domain attribute.
 * Returns undefined on platform multi-tenant hosts (host-only cookie).
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
