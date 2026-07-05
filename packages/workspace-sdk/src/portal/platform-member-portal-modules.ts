/**
 * PS-5 / BP-4 — platform-owned member portal modules (DL-30).
 * @see docs/phase-19/member-portal-shell/member-portal-registry-schema.mdoc §9
 */

import type { MemberModuleManifest } from "./member-module-manifest";

/** Platform-owned home module — workspace manifests MUST NOT declare id `home`. */
export const PLATFORM_MEMBER_PORTAL_HOME_MODULE = Object.freeze({
  id: "home",
  routePath: "/me/home",
  nav: Object.freeze({
    tier: "primary" as const,
    labelKey: "home",
  }),
}) satisfies MemberModuleManifest;

/** Merge platform-owned modules into workspace registry rows (runtime/codegen contract). */
export function mergePlatformMemberPortalModules(
  modules: readonly MemberModuleManifest[]
): readonly MemberModuleManifest[] {
  if (modules.some((module) => module.id === "home")) {
    throw new Error("MEMBER_PORTAL_PLATFORM_HOME_COLLISION");
  }
  return Object.freeze([PLATFORM_MEMBER_PORTAL_HOME_MODULE, ...modules]);
}

/** Entitlement keys for all modules in the effective registry (DL-09). */
export function memberPortalEntitlementKey(moduleId: string): string {
  return `member.module.${moduleId}`;
}
