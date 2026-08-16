import { resolveMarketingPublicBaseUrl } from "./resolve-marketing-public-base-url";
import { resolvePortalPublicBaseUrl } from "./resolve-portal-public-base-url";

function readHttpOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "*") {
    return null;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    if (url.username !== "" || url.password !== "") {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * PCMS-CORS-02 — credentialed CORS allow origin for Portal `/api/public-auth/*`.
 * Paired marketing public origin + portal public origin only. Never `*`.
 */
export function resolvePublicAuthCorsAllowOrigin(input: {
  readonly ingressHost: string;
  readonly originHeader: string | null | undefined;
}): string | null {
  const origin = readHttpOrigin(input.originHeader ?? "");
  if (origin === null) {
    return null;
  }

  const allowed = new Set<string>();
  const portalOrigin = readHttpOrigin(resolvePortalPublicBaseUrl(input.ingressHost));
  const marketingOrigin = readHttpOrigin(resolveMarketingPublicBaseUrl(input.ingressHost));
  if (portalOrigin !== null) {
    allowed.add(portalOrigin);
  }
  if (marketingOrigin !== null) {
    allowed.add(marketingOrigin);
  }

  return allowed.has(origin) ? origin : null;
}
