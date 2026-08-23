import type { WorkspacePluginId } from "../plugin/workspace-plugin-id";

import type { MemberModuleManifest, MemberPortalSurface } from "./member-module-manifest";
import {
  assertMemberPortalEnabled,
  MemberPortalDisabledError,
  resolveMemberPortalContract,
} from "./member-portal-contract";
import { memberPortalEntitlementKey } from "./platform-member-portal-modules";

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

export {
  MemberPortalDisabledError,
  type MemberPortalAvailability,
  type MemberPortalContract,
  isMemberPortalEnabled,
  resolveMemberPortalContract,
} from "./member-portal-contract";

function requireEnabledSurface(pluginId: WorkspacePluginId | string): MemberPortalSurface {
  const contract = resolveMemberPortalContract(pluginId);
  if (contract.availability === "off") {
    throw new MemberPortalDisabledError(pluginId);
  }
  return contract.surface;
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
  return Object.freeze(requireEnabledSurface(pluginId));
}

/** Route for `defaultPrimaryModuleId` when member portal is enabled (DL-06). */
export function resolveMemberPortalDefaultRoutePath(pluginId: WorkspacePluginId | string): string {
  const surface = requireEnabledSurface(pluginId);
  return findModuleRoutePath(surface.modules, surface.defaultPrimaryModuleId);
}

/** Per-module route path — GSH `resolvePortalMemberModuleUrl` input (PS-3). */
export function resolveMemberPortalModuleRoutePath(
  pluginId: WorkspacePluginId | string,
  moduleId: string
): string {
  const surface = requireEnabledSurface(pluginId);
  return findModuleRoutePath(surface.modules, moduleId);
}

/** Reverse lookup — module dispatcher input (PS-5 / DL-24). */
export function resolveMemberPortalModuleByRoutePath(
  pluginId: WorkspacePluginId | string,
  routePath: string
): MemberModuleManifest {
  const surface = requireEnabledSurface(pluginId);
  const module = surface.modules.find((entry) => entry.routePath === routePath);
  if (module === undefined) {
    throw new MemberPortalUnknownRouteError(routePath);
  }
  return module;
}

/** Entitlement keys for effective registry modules (PS-5 bootstrap — DL-09). */
export function listMemberPortalEntitlementKeys(
  pluginId: WorkspacePluginId | string
): readonly string[] {
  const surface = requireEnabledSurface(pluginId);
  return Object.freeze(surface.modules.map((module) => memberPortalEntitlementKey(module.id)));
}

/** Enabled check for portal routing without throwing. */
export function tryResolveMemberPortalDefaultRoutePath(
  pluginId: WorkspacePluginId | string
): string | null {
  const contract = resolveMemberPortalContract(pluginId);
  if (contract.availability === "off") {
    return null;
  }
  return findModuleRoutePath(contract.surface.modules, contract.surface.defaultPrimaryModuleId);
}

export { assertMemberPortalEnabled };
