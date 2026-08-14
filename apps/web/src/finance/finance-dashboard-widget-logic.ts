import { isAdminOrOwnerRole } from "@/features/bookings/bookings-command-center-types";
import {
  buildFinanceKpiCards,
  parseFinanceSummary,
  type FinanceSummary,
} from "@/finance/finance-reports-logic";
import { shouldShowFinanceNav } from "@/finance/finance-nav-enablement";

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
  // Dashboard never surfaces installments KPI (first-customer / altitude).
  return buildFinanceKpiCards(summary, 0, { includeInstallments: false });
}

export function parseDashboardFinanceSummary(raw: unknown): FinanceSummary {
  return parseFinanceSummary(raw);
}

export function financeDashboardWidgetHref(): string {
  return "/finance";
}
