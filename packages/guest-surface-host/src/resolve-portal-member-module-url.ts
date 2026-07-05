import {
  MemberPortalNotConfiguredError,
  resolveMemberPortalDefaultRoutePath,
  resolveMemberPortalModuleRoutePath,
} from "@app-tour/workspace-sdk";

import { resolvePluginIdFromIngressHost } from "./resolve-plugin-id-from-ingress-host";
import { resolvePortalPublicBaseUrl } from "./resolve-portal-public-base-url";

/** Permanent alias route — DL-03 URL freeze; GSH fallback when registry unavailable. */
export const FROZEN_MEMBER_TRIPS_ROUTE_PATH = "/me/registrations";

function resolveMemberRoutePath(pluginId: string | null, moduleId?: string): string {
  if (moduleId === "trips") {
    return FROZEN_MEMBER_TRIPS_ROUTE_PATH;
  }

  if (pluginId === null) {
    return FROZEN_MEMBER_TRIPS_ROUTE_PATH;
  }

  try {
    if (moduleId === undefined) {
      return resolveMemberPortalDefaultRoutePath(pluginId);
    }
    try {
      return resolveMemberPortalModuleRoutePath(pluginId, moduleId);
    } catch {
      return resolveMemberPortalDefaultRoutePath(pluginId);
    }
  } catch (error) {
    if (error instanceof MemberPortalNotConfiguredError) {
      return FROZEN_MEMBER_TRIPS_ROUTE_PATH;
    }
    throw error;
  }
}

/**
 * Registry-aware cross-host member module URL (DL-22).
 * @see docs/phase-19/member-portal-shell/builder-migration-contract.mdoc
 */
export function resolvePortalMemberModuleUrl(host: string, moduleId?: string): string {
  const pluginId = resolvePluginIdFromIngressHost(host);
  const routePath = resolveMemberRoutePath(pluginId, moduleId);
  return `${resolvePortalPublicBaseUrl(host)}${routePath}`;
}
