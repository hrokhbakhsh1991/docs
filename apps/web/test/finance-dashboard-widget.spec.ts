/**
 * Phase 9.7 R1 — dashboard finance widget (CP-9.7-09).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINANCE_DASHBOARD_WIDGET_TEST_IDS,
  buildDashboardFinanceKpiCards,
  financeDashboardWidgetHref,
  parseDashboardFinanceSummary,
  shouldShowFinanceDashboardWidget,
} from "../src/finance/finance-dashboard-widget-logic";

describe("finance-dashboard-widget.spec.ts — Phase 9.7 R1", () => {
  it("WEB-9.7-DASH-01 shouldShowFinanceDashboardWidget is denali admin/owner only", () => {
    assert.equal(shouldShowFinanceDashboardWidget("denali", "owner"), true);
    assert.equal(shouldShowFinanceDashboardWidget("denali", "member"), false);
    assert.equal(shouldShowFinanceDashboardWidget("urban", "owner"), false);
  });

  it("WEB-9.7-DASH-02 buildDashboardFinanceKpiCards omits overdue installments", () => {
    const cards = buildDashboardFinanceKpiCards(
      parseDashboardFinanceSummary({ pendingManualPayments: 2, pendingReceiptReviews: 1 })
    );
    assert.equal(cards.some((card) => card.id === "overdue-installments"), false);
    assert.equal(cards.length, 3);
  });

  it("WEB-9.7-DASH-03 finance dashboard widget test ids are stable", () => {
    assert.equal(FINANCE_DASHBOARD_WIDGET_TEST_IDS.widget, "dashboard-widget-finance");
    assert.equal(FINANCE_DASHBOARD_WIDGET_TEST_IDS.kpiStrip, "dashboard-finance-kpi-strip");
  });

  it("WEB-9.7-DASH-04 financeDashboardWidgetHref points to command center", () => {
    assert.equal(financeDashboardWidgetHref(), "/finance");
  });
});
