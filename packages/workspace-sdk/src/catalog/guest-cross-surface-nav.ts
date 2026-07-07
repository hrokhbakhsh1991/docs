/**
 * PS-4 — Guest cross-surface navigation manifest types (DL-05, DL-37).
 * @see docs/phase-19/member-portal-shell/guest-cross-surface-nav-schema.mdoc
 */

export type GuestCrossSurfaceNavSurfaceKind = "marketing" | "portal_egress";

export type GuestCrossSurfaceNavEgressKind =
  | "member_module"
  | "marketing_home"
  | "marketing_tours";

export type GuestCrossSurfaceNavVisibility = "always" | "club" | "platform_mother";

export type GuestCrossSurfaceNavLink = {
  readonly id: string;
  readonly labelKey: string;
  readonly surface: GuestCrossSurfaceNavSurfaceKind;
  readonly path?: string;
  readonly egress?: GuestCrossSurfaceNavEgressKind;
  /** Required when `egress=member_module` — validated against memberPortal registry at codegen. */
  readonly memberModuleId?: string;
  readonly visibleWhen?: GuestCrossSurfaceNavVisibility;
};

export type GuestCrossSurfaceNavSurface = {
  readonly version: 1;
  readonly links: readonly GuestCrossSurfaceNavLink[];
};

export const GUEST_CROSS_SURFACE_PLATFORM_MOTHER_ONLY_PATHS = Object.freeze([
  "/about",
  "/contact",
  "/pricing",
] as const);

const PLATFORM_MOTHER_ONLY = new Set<string>(GUEST_CROSS_SURFACE_PLATFORM_MOTHER_ONLY_PATHS);

const LINK_ID_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
const GCSN_RESERVED_MEMBER_MODULE_IDS = new Set(["more", "api", "catalog"]);

/** Fail closed before registry Map construction. */
export function validateGuestCrossSurfaceNavLinks(links: readonly GuestCrossSurfaceNavLink[]): void {
  const seenIds = new Set<string>();

  for (const link of links) {
    if (!LINK_ID_PATTERN.test(link.id)) {
      throw new Error(`GCSN-INVALID-ID:${link.id}`);
    }
    if (seenIds.has(link.id)) {
      throw new Error(`GCSN-DUP-ID:${link.id}`);
    }
    seenIds.add(link.id);

    const visibleWhen = link.visibleWhen ?? "club";

    if (link.surface === "marketing") {
      if (typeof link.path !== "string" || !link.path.startsWith("/")) {
        throw new Error(`GCSN-INVALID-PATH:${link.id}`);
      }
      if (link.path.startsWith("/me")) {
        throw new Error(`GCSN-PORTAL-PATH:${link.id}`);
      }
      if (link.path.includes("://")) {
        throw new Error(`GCSN-ABSOLUTE:${link.id}`);
      }
      if (link.egress !== undefined) {
        throw new Error(`GCSN-EGRESS-PATH:${link.id}`);
      }
      if (visibleWhen === "club" && PLATFORM_MOTHER_ONLY.has(link.path)) {
        throw new Error(`GCSN-404-RISK:${link.id}:${link.path}`);
      }
    }

    if (link.surface === "portal_egress") {
      if (link.path !== undefined) {
        throw new Error(`GCSN-EGRESS-PATH:${link.id}`);
      }
      if (
        link.egress !== "member_module" &&
        link.egress !== "marketing_home" &&
        link.egress !== "marketing_tours"
      ) {
        throw new Error(`GCSN-INVALID-EGRESS:${link.id}`);
      }
      if (link.egress === "member_module") {
        if (typeof link.memberModuleId !== "string" || link.memberModuleId.length === 0) {
          throw new Error(`GCSN-MISSING-MEMBER-MODULE-ID:${link.id}`);
        }
        if (GCSN_RESERVED_MEMBER_MODULE_IDS.has(link.memberModuleId)) {
          throw new Error(`GCSN-RESERVED-MEMBER-MODULE-ID:${link.id}`);
        }
      }
    }

    if (link.memberModuleId !== undefined && link.egress !== "member_module") {
      throw new Error(`GCSN-MEMBER-MODULE-ID-EGRESS:${link.id}`);
    }
  }

  if (links.length > 8) {
    throw new Error("GCSN-LINK-OVERFLOW");
  }
}
