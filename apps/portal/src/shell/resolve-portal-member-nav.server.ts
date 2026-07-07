import {
  MEMBER_PORTAL_MORE_ROUTE_PATH,
  memberPortalEntitlementKey,
  resolveMemberPortalModules,
  shouldRenderMemberPortalMoreHub,
  type MemberModuleManifest,
} from "@app-tour/workspace-sdk";

export type PortalMemberNavItem = {
  readonly href: string;
  readonly labelKey: string;
  readonly testId: string;
};

const PLATFORM_MORE_NAV_ITEM = Object.freeze({
  href: MEMBER_PORTAL_MORE_ROUTE_PATH,
  labelKey: "more",
  testId: "portal-shell-nav-more",
}) satisfies PortalMemberNavItem;

function memberNavTestId(module: MemberModuleManifest): string {
  if (module.nav.tier === "user_menu") {
    return `portal-shell-user-menu-${module.id}`;
  }
  return `portal-shell-nav-${module.id}`;
}

function toNavItem(module: MemberModuleManifest): PortalMemberNavItem {
  return {
    href: module.routePath,
    labelKey: module.nav.labelKey,
    testId: memberNavTestId(module),
  };
}

function isModuleEntitled(
  module: MemberModuleManifest,
  grantedEntitlementKeys: ReadonlySet<string>
): boolean {
  return grantedEntitlementKeys.has(memberPortalEntitlementKey(module.id));
}

function filterEntitledModules(
  modules: readonly MemberModuleManifest[],
  grantedEntitlementKeys: ReadonlySet<string>
): readonly MemberModuleManifest[] {
  return Object.freeze(modules.filter((module) => isModuleEntitled(module, grantedEntitlementKeys)));
}

function buildPrimaryNavWithHubSlot(
  primaryModules: readonly MemberModuleManifest[],
  hubModuleCount: number
): readonly PortalMemberNavItem[] {
  const primaryNav = primaryModules.map(toNavItem);
  if (!shouldRenderMemberPortalMoreHub(hubModuleCount)) {
    return Object.freeze(primaryNav);
  }
  if (primaryNav.length >= 5) {
    return Object.freeze([...primaryNav.slice(0, 4), PLATFORM_MORE_NAV_ITEM]);
  }
  return Object.freeze([...primaryNav, PLATFORM_MORE_NAV_ITEM]);
}

/** Registry-driven primary + hub + user-menu nav intersected with entitlements (PS-5 / DL-09). */
export function resolvePortalMemberNavForPlugin(
  pluginId: string,
  grantedEntitlementKeys: readonly string[]
): {
  readonly primaryNav: readonly PortalMemberNavItem[];
  readonly hubNav: readonly PortalMemberNavItem[];
  readonly userMenuNav: readonly PortalMemberNavItem[];
} {
  const surface = resolveMemberPortalModules(pluginId);
  const granted = new Set(grantedEntitlementKeys);
  const entitledModules = filterEntitledModules(surface.modules, granted);
  const hubModules = entitledModules.filter((module) => module.nav.tier === "secondary");
  const primaryModules = entitledModules.filter((module) => module.nav.tier === "primary");

  return Object.freeze({
    primaryNav: buildPrimaryNavWithHubSlot(primaryModules, hubModules.length),
    hubNav: Object.freeze(hubModules.map(toNavItem)),
    userMenuNav: Object.freeze(
      entitledModules.filter((module) => module.nav.tier === "user_menu").map(toNavItem)
    ),
  });
}
