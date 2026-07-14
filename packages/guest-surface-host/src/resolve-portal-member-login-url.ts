import {
  isMemberPortalEnabled,
  tryResolveMemberPortalDefaultRoutePath,
} from "@app-tour/workspace-sdk";

import { resolvePluginIdFromIngressHost } from "./resolve-plugin-id-from-ingress-host";
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
export function resolvePortalMemberLoginPath(host: string, returnPath?: string): string | null {
  const pluginId = resolvePluginIdFromIngressHost(host);
  if (pluginId === null || !isMemberPortalEnabled(pluginId)) {
    return null;
  }

  const params = new URLSearchParams({
    portalReturn: sanitizePortalReturn(returnPath, pluginId),
  });
  return `/login?${params.toString()}`;
}

/** Cross-host member login URL for marketing sign-in egress. */
export function resolvePortalMemberLoginUrl(host: string, returnPath?: string): string | null {
  const loginPath = resolvePortalMemberLoginPath(host, returnPath);
  if (loginPath === null) {
    return null;
  }
  return `${resolvePortalPublicBaseUrl(host)}${loginPath}`;
}
