import {
  isMemberPortalEnabled,
  tryResolveMemberPortalDefaultRoutePath,
  resolveMemberPortalModuleRoutePath,
} from "@app-tour/workspace-sdk";

import { resolveIngressPluginId } from "./resolve-ingress-plugin-id";
import { resolvePortalPublicBaseUrl } from "./resolve-portal-public-base-url";

function resolveMemberRoutePath(pluginId: string | null, moduleId?: string): string | null {
  if (pluginId === null || !isMemberPortalEnabled(pluginId)) {
    return null;
  }

  try {
    if (moduleId === undefined) {
      return tryResolveMemberPortalDefaultRoutePath(pluginId);
    }
    return resolveMemberPortalModuleRoutePath(pluginId, moduleId);
  } catch {
    return tryResolveMemberPortalDefaultRoutePath(pluginId);
  }
}

/**
 * Registry-aware cross-host member module URL (DL-22).
 * Returns null when member portal is disabled for the workspace.
 */
export function resolvePortalMemberModuleUrl(
  host: string,
  moduleId?: string,
  pluginIdOverride?: string | null
): string | null {
  const pluginId = resolveIngressPluginId(host, pluginIdOverride);
  const routePath = resolveMemberRoutePath(pluginId, moduleId);
  if (routePath === null) {
    return null;
  }
  return `${resolvePortalPublicBaseUrl(host)}${routePath}`;
}
