import {
  memberPortalEntitlementKey,
  resolveMemberPortalModules,
} from "@app-tour/workspace-sdk";

export type MemberHomeModuleCard = {
  readonly id: string;
  readonly routePath: string;
  readonly labelKey: string;
  readonly entitled: boolean;
};

export type MemberHomePayload = {
  readonly ok: true;
  readonly tenantId: string;
  readonly workspaceId: string;
  readonly evaluatedAt: string;
  readonly welcome: {
    readonly titleKey: "title";
    readonly ledeKey: "lede";
  };
  readonly modules: readonly MemberHomeModuleCard[];
};

/** PS-5 bootstrap — home hub cards from registry ∩ entitlements (DL-19). */
export function buildMemberHomePayload(input: {
  readonly tenantId: string;
  readonly pluginId: string;
  readonly grantedEntitlementKeys: readonly string[];
}): MemberHomePayload {
  const surface = resolveMemberPortalModules(input.pluginId);
  const granted = new Set(input.grantedEntitlementKeys);
  const modules = Object.freeze(
    surface.modules
      .filter((module) => module.nav.tier === "primary")
      .map((module) =>
        Object.freeze({
          id: module.id,
          routePath: module.routePath,
          labelKey: module.nav.labelKey,
          entitled: granted.has(memberPortalEntitlementKey(module.id)),
        })
      )
  );

  return Object.freeze({
    ok: true,
    tenantId: input.tenantId,
    workspaceId: input.pluginId,
    evaluatedAt: new Date().toISOString(),
    welcome: Object.freeze({
      titleKey: "title" as const,
      ledeKey: "lede" as const,
    }),
    modules,
  });
}
