import {
  isMemberPortalEnabled,
  tryResolveMemberPortalDefaultRoutePath,
} from "@app-tour/workspace-sdk";

import { resolveIngressPluginId } from "./resolve-ingress-plugin-id";
import { resolvePortalPublicBaseUrl } from "./resolve-portal-public-base-url";

function sanitizePortalReturn(returnPath: string | undefined, pluginId: string): string {
  if (returnPath !== undefined) {
    const trimmed = returnPath.trim();
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
      return trimmed;
    }
  }
  return tryResolveMemberPortalDefaultRoutePath(pluginId) ?? "/me/registrations";
}

/**
 * Relative portal member login path — dedicated `/login` (PCMS-03 sign-in egress).
 * Optional `portalReturn` query when `returnPath` is a safe relative member route.
 */
export function resolvePortalMemberLoginPath(
  host: string,
  returnPath?: string,
  pluginIdOverride?: string | null
): string | null {
  const pluginId = resolveIngressPluginId(host, pluginIdOverride);
  if (pluginId === null || !isMemberPortalEnabled(pluginId)) {
    return null;
  }

  const params = new URLSearchParams({
    portalReturn: sanitizePortalReturn(returnPath, pluginId),
  });
  return `/login?${params.toString()}`;
}

/** Cross-host member login URL for marketing sign-in egress. */
export function resolvePortalMemberLoginUrl(
  host: string,
  returnPath?: string,
  pluginIdOverride?: string | null
): string | null {
  const loginPath = resolvePortalMemberLoginPath(host, returnPath, pluginIdOverride);
  if (loginPath === null) {
    return null;
  }
  return `${resolvePortalPublicBaseUrl(host)}${loginPath}`;
}
