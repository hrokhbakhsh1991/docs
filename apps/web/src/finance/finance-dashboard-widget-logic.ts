import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  buildFinanceKpiCards,
  parseFinanceSummary,
  type FinanceSummary,
} from "@/finance/finance-reports-logic";
import { shouldShowFinanceNav } from "@/finance/finance-nav-access";

export const FINANCE_DASHBOARD_WIDGET_TEST_IDS = {
  widget: "dashboard-widget-finance",
  kpiStrip: "dashboard-finance-kpi-strip",
} as const;

export function shouldShowFinanceDashboardWidget(
  pluginId: string,
  role: string
): boolean {
  return shouldShowFinanceNav(pluginId) && isAdminOrOwnerRole(role);
}

export function buildDashboardFinanceKpiCards(summary: FinanceSummary) {
  return buildFinanceKpiCards(summary, 0).filter((card) => card.id !== "overdue-installments");
}

export function parseDashboardFinanceSummary(raw: unknown): FinanceSummary {
  return parseFinanceSummary(raw);
}

export function financeDashboardWidgetHref(): string {
  return "/finance";
}
