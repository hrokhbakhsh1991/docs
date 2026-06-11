import { FINANCE_DASHBOARD_WIDGET_TEST_IDS } from "@/finance/finance-dashboard-widget-logic";

export type DashboardWidgetId = "stats" | "tours" | "bookings" | "registrations" | "finance";

export type DashboardWidgetDescriptor = {
  readonly id: DashboardWidgetId;
  readonly title: string;
  readonly testId: string;
};

export const DASHBOARD_WIDGET_REGISTRY: readonly DashboardWidgetDescriptor[] = [
  { id: "stats", title: "Overview", testId: "dashboard-widget-stats" },
  { id: "tours", title: "Tours", testId: "dashboard-widget-tours" },
  { id: "bookings", title: "Bookings", testId: "dashboard-widget-bookings" },
  { id: "registrations", title: "Registrations", testId: "dashboard-widget-registrations" },
] as const;

export const FINANCE_DASHBOARD_WIDGET_DESCRIPTOR: DashboardWidgetDescriptor = {
  id: "finance",
  title: "Finance",
  testId: FINANCE_DASHBOARD_WIDGET_TEST_IDS.widget,
};

export const DASHBOARD_GRID_TEST_ID = "operator-dashboard-grid" as const;
