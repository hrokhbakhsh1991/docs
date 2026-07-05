import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import type { MemberModuleManifest, MemberPortalSurface } from "./member-module-manifest";
import {
  memberPortalEntitlementKey,
  mergePlatformMemberPortalModules,
} from "./platform-member-portal-modules";
import { WORKSPACE_MEMBER_PORTAL_SURFACES } from "./workspace-member-portal-surfaces.generated";

export class MemberPortalNotConfiguredError extends Error {
  readonly code = "MEMBER_PORTAL_NOT_CONFIGURED" as const;

  constructor(pluginId: string) {
    super(`MEMBER_PORTAL_NOT_CONFIGURED:${pluginId}`);
    this.name = "MemberPortalNotConfiguredError";
  }
}

export class MemberPortalUnknownRouteError extends Error {
  readonly code = "MEMBER_PORTAL_UNKNOWN_ROUTE" as const;

  constructor(routePath: string) {
    super(`MEMBER_PORTAL_UNKNOWN_ROUTE:${routePath}`);
    this.name = "MemberPortalUnknownRouteError";
  }
}

export type ResolvedMemberPortalSurface = MemberPortalSurface;

function resolveEffectiveSurface(pluginId: WorkspacePluginId | string): MemberPortalSurface {
  const generated = WORKSPACE_MEMBER_PORTAL_SURFACES[pluginId];
  if (generated === undefined) {
    throw new MemberPortalNotConfiguredError(pluginId);
  }
  return Object.freeze({
    manifestVersion: generated.manifestVersion,
    defaultPrimaryModuleId: generated.defaultPrimaryModuleId,
    modules: mergePlatformMemberPortalModules(generated.modules),
  });
}

function findModuleRoutePath(modules: readonly MemberModuleManifest[], moduleId: string): string {
  const module = modules.find((entry) => entry.id === moduleId);
  if (module === undefined) {
    throw new Error(`MEMBER_PORTAL_UNKNOWN_MODULE:${moduleId}`);
  }
  return module.routePath;
}

/** Portal shell + BFF member module registry (manifest + platform-owned merge). */
export function resolveMemberPortalModules(
  pluginId: WorkspacePluginId | string
): ResolvedMemberPortalSurface {
  return Object.freeze(resolveEffectiveSurface(pluginId));
}

/** Route for `defaultPrimaryModuleId` — portal `/` and bare `/me` redirect (DL-06). */
export function resolveMemberPortalDefaultRoutePath(pluginId: WorkspacePluginId | string): string {
  const surface = resolveEffectiveSurface(pluginId);
  return findModuleRoutePath(surface.modules, surface.defaultPrimaryModuleId);
}

/** Per-module route path — GSH `resolvePortalMemberModuleUrl` input (PS-3). */
export function resolveMemberPortalModuleRoutePath(
  pluginId: WorkspacePluginId | string,
  moduleId: string
): string {
  const surface = resolveEffectiveSurface(pluginId);
  return findModuleRoutePath(surface.modules, moduleId);
}

/** Reverse lookup — module dispatcher input (PS-5 / DL-24). */
export function resolveMemberPortalModuleByRoutePath(
  pluginId: WorkspacePluginId | string,
  routePath: string
): MemberModuleManifest {
  const surface = resolveEffectiveSurface(pluginId);
  const module = surface.modules.find((entry) => entry.routePath === routePath);
  if (module === undefined) {
    throw new MemberPortalUnknownRouteError(routePath);
  }
  return module;
}

/** Entitlement keys for effective registry modules (PS-5 bootstrap — DL-09). */
export function listMemberPortalEntitlementKeys(pluginId: WorkspacePluginId | string): readonly string[] {
  const surface = resolveEffectiveSurface(pluginId);
  return Object.freeze(surface.modules.map((module) => memberPortalEntitlementKey(module.id)));
}
