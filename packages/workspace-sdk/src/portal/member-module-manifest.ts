/**
 * PS-2 — Member portal module registry types (mirrors operator settings manifest).
 * @see docs/phase-19/member-portal-shell/member-portal-registry-schema.mdoc
 */

export type MemberNavTier = "primary" | "secondary" | "hidden" | "user_menu";

const MEMBER_NAV_TIERS: readonly MemberNavTier[] = [
  "primary",
  "secondary",
  "hidden",
  "user_menu",
] as const;

export const MEMBER_PORTAL_RESERVED_MODULE_IDS = Object.freeze([
  "home",
  "more",
  "api",
  "catalog",
] as const);

export type MemberPortalReservedModuleId = (typeof MEMBER_PORTAL_RESERVED_MODULE_IDS)[number];

export type MemberModuleManifest = {
  readonly id: string;
  readonly routePath: string;
  readonly nav: {
    readonly tier: MemberNavTier;
    readonly labelKey: string;
  };
};

export type MemberPortalSurface = {
  readonly manifestVersion: 1;
  readonly defaultPrimaryModuleId: string;
  readonly modules: readonly MemberModuleManifest[];
};

const RESERVED_MODULE_ID_SET = new Set<string>(MEMBER_PORTAL_RESERVED_MODULE_IDS);

function isMemberNavTier(value: string): value is MemberNavTier {
  return (MEMBER_NAV_TIERS as readonly string[]).includes(value);
}

function assertValidRoutePath(routePath: string, context: string): void {
  if (!routePath.startsWith("/me/") || routePath === "/me") {
    throw new Error(`MEMBER_PORTAL_INVALID_ROUTE:${context}:${routePath}`);
  }
}

/** Fail closed before registry Map construction (DL-04, DL-30). */
export function validateMemberPortalManifest(
  modules: readonly MemberModuleManifest[],
  defaultPrimaryModuleId: string
): void {
  const seenIds = new Set<string>();
  let primaryCount = 0;

  for (const module of modules) {
    if (RESERVED_MODULE_ID_SET.has(module.id)) {
      throw new Error(`MEMBER_PORTAL_RESERVED_MODULE_ID:${module.id}`);
    }
    if (seenIds.has(module.id)) {
      throw new Error(`MEMBER_PORTAL_DUPLICATE_ID:${module.id}`);
    }
    seenIds.add(module.id);

    if (!isMemberNavTier(module.nav.tier)) {
      throw new Error(`MEMBER_PORTAL_UNKNOWN_NAV_TIER:${module.nav.tier}`);
    }
    if (module.nav.tier === "primary") {
      primaryCount += 1;
    }

    assertValidRoutePath(module.routePath, module.id);
  }

  if (primaryCount > 5) {
    throw new Error("MEMBER_PORTAL_PRIMARY_OVERFLOW");
  }

  if (!seenIds.has(defaultPrimaryModuleId)) {
    throw new Error(`MEMBER_PORTAL_UNKNOWN_DEFAULT:${defaultPrimaryModuleId}`);
  }
}
