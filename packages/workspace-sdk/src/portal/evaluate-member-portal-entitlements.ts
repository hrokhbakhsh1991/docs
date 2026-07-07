/**
 * PS-6 — tier-aware member portal entitlement evaluation (DL-09).
 * @see docs/phase-19/platform-portal-member-entitlements.mdoc §3.2
 */

import type { MemberModuleManifest, MemberPortalSurface } from "./member-module-manifest";
import { memberPortalEntitlementKey } from "./platform-member-portal-modules";
import { resolveMemberPortalContract } from "./member-portal-contract";

export type MemberEntitlementDenialReason =
  | "not_entitled"
  | "module_disabled"
  | "plan_limit";

export type MemberEntitlementDenial = {
  readonly key: string;
  readonly reason: MemberEntitlementDenialReason;
};

export type MemberPortalEntitlementsEvaluation = {
  readonly allKeys: readonly string[];
  readonly granted: readonly string[];
  readonly denied: readonly MemberEntitlementDenial[];
};

const DEFAULT_GRANT_TIERS = new Set<MemberModuleManifest["nav"]["tier"]>([
  "primary",
  "secondary",
  "user_menu",
]);

function isDefaultGrantedTier(tier: MemberModuleManifest["nav"]["tier"]): boolean {
  return DEFAULT_GRANT_TIERS.has(tier);
}

function resolveDenialReason(module: MemberModuleManifest | undefined): MemberEntitlementDenialReason {
  if (module?.nav.tier === "hidden") {
    return "plan_limit";
  }
  return "not_entitled";
}

/** Evaluate entitlements for a resolved surface (unit-test entry point). */
export function evaluateMemberPortalEntitlementsForSurface(
  surface: MemberPortalSurface,
  options?: { readonly explicitModuleIds?: readonly string[] }
): MemberPortalEntitlementsEvaluation {
  const explicitModuleIds = new Set(options?.explicitModuleIds ?? []);
  const moduleById = new Map(surface.modules.map((module) => [module.id, module]));
  const allKeys = Object.freeze(surface.modules.map((module) => memberPortalEntitlementKey(module.id)));

  const grantedSet = new Set<string>();
  for (const module of surface.modules) {
    const key = memberPortalEntitlementKey(module.id);
    if (isDefaultGrantedTier(module.nav.tier) || explicitModuleIds.has(module.id)) {
      grantedSet.add(key);
    }
  }

  const granted = Object.freeze(allKeys.filter((key) => grantedSet.has(key)));
  const denied = Object.freeze(
    allKeys
      .filter((key) => !grantedSet.has(key))
      .map((key) => {
        const moduleId = key.slice("member.module.".length);
        const module = moduleById.get(moduleId);
        return Object.freeze({
          key,
          reason: resolveDenialReason(module),
        });
      })
  );

  return Object.freeze({ allKeys, granted, denied });
}

/** Authoritative tier-aware entitlement evaluation for a workspace plugin. */
export function evaluateMemberPortalEntitlements(
  pluginId: string,
  options?: { readonly explicitModuleIds?: readonly string[] }
): MemberPortalEntitlementsEvaluation {
  const contract = resolveMemberPortalContract(pluginId);
  if (contract.availability === "off") {
    return Object.freeze({ allKeys: [], granted: [], denied: [] });
  }
  return evaluateMemberPortalEntitlementsForSurface(contract.surface, options);
}

/** Default-granted keys only — modules with primary/secondary/user_menu tier. */
export function listMemberPortalDefaultGrantedEntitlementKeys(
  pluginId: string
): readonly string[] {
  const evaluation = evaluateMemberPortalEntitlements(pluginId);
  return evaluation.granted;
}
