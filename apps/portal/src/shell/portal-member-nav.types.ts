export const PORTAL_MEMBER_SHELL_TEST_IDS = {
  main: "portal-member-main",
  skipLink: "portal-member-skip-link",
  bottomNav: "portal-shell-bottom-nav",
  header: "portal-shell-header",
  navTrips: "portal-shell-nav-trips",
  userMenuProfile: "portal-shell-user-menu-profile",
} as const;

export type PortalMemberPrimaryNavItem = {
  readonly href: "/me/registrations";
  readonly labelKey: "trips";
  readonly testId: typeof PORTAL_MEMBER_SHELL_TEST_IDS.navTrips;
};

/** Phase 1 static primary nav — registry-driven in PS-2. */
export const PHASE1_PRIMARY_NAV: readonly PortalMemberPrimaryNavItem[] = [
  {
    href: "/me/registrations",
    labelKey: "trips",
    testId: PORTAL_MEMBER_SHELL_TEST_IDS.navTrips,
  },
];
