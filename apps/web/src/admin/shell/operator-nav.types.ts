export type OperatorNavItem = {
  readonly pathKey: string;
  readonly href: string;
};

export const OPERATOR_NAV_TEST_IDS = {
  nav: "operator-nav",
  main: "operator-main",
  menuToggle: "operator-menu-toggle",
  skipLink: "operator-skip-link",
  accountMenu: "operator-account-menu",
  workspaceSwitcher: "operator-workspace-switcher",
  themeToggle: "operator-theme-toggle",
  brand: "operator-brand",
  newTourCta: "operator-new-tour-cta",
  sidebarCollapse: "operator-sidebar-collapse",
} as const;
