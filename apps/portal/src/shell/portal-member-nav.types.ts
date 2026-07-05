export const PORTAL_MEMBER_SHELL_TEST_IDS = {
  main: "portal-member-main",
  skipLink: "portal-member-skip-link",
  bottomNav: "portal-shell-bottom-nav",
  header: "portal-shell-header",
  navTrips: "portal-shell-nav-trips",
  userMenuProfile: "portal-shell-user-menu-profile",
} as const;

export type { PortalMemberNavItem } from "./resolve-portal-member-nav.server";
