export type TourWorkspaceSubnavTab = "registrations" | "waitlist" | "transport" | "finance";

export const TOUR_WORKSPACE_TEST_IDS = {
  page: "operator-tour-workspace-page",
  subnav: "operator-tour-workspace-subnav",
  header: "operator-tour-workspace-header",
  headerKpis: "operator-tour-workspace-header-kpis",
  headerMoneyKpis: "operator-tour-workspace-header-money-kpis",
  tabRegistrations: "operator-tour-workspace-tab-registrations",
  tabWaitlist: "operator-tour-workspace-tab-waitlist",
  tabTransport: "operator-tour-workspace-tab-transport",
  tabFinance: "operator-tour-workspace-tab-finance",
  tabBadge: "operator-tour-workspace-tab-badge",
  registrationsPanel: "operator-tour-workspace-registrations-panel",
  waitlistPanel: "operator-tour-workspace-waitlist-panel",
  transportPanel: "operator-tour-workspace-transport-panel",
  financePanel: "operator-tour-workspace-finance-panel",
  openBookings: "operator-tour-workspace-open-bookings",
  openFinance: "operator-tour-workspace-open-finance",
  roleBanner: "operator-tour-workspace-role-banner",
  opsCountsError: "operator-tour-workspace-ops-counts-error",
} as const;
