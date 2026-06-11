/**
 * Phase 9.2/9.3 — dashboard live widgets (CP-9.2-07 extension).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DASHBOARD_WIDGETS_TEST_IDS,
  buildDashboardBookingsKpiCards,
  buildDashboardOverviewKpiCards,
  dashboardPendingBookingsHref,
  dashboardToursHref,
  parseDashboardBookingsSummary,
  parseDashboardToursList,
  selectRecentToursForDashboard,
  selectRegistrationQueueChips,
} from "../src/admin/dashboard/dashboard-widgets-logic";

describe("dashboard-widgets-logic.spec.ts — Phase 9.2 dashboard data", () => {
  it("WEB-9.2-DASH-01 parseDashboardToursList tolerates malformed payloads", () => {
    const parsed = parseDashboardToursList({
      total: 2,
      page: 1,
      limit: 3,
      items: [{ id: "t-1", title: "Denali Ridge" }],
    });
    assert.equal(parsed.total, 2);
    assert.equal(parsed.items.length, 1);
    assert.equal(parsed.items[0]?.title, "Denali Ridge");
    assert.deepEqual(parseDashboardToursList(null), {
      items: [],
      total: 0,
      page: 1,
      limit: 0,
    });
  });

  it("WEB-9.2-DASH-02 buildDashboardOverviewKpiCards merges tours total and summary", () => {
    const cards = buildDashboardOverviewKpiCards(
      4,
      parseDashboardBookingsSummary({ pending: 3, approvedToday: 1, departures7d: 2, waitlist: 0 })
    );
    assert.equal(cards.length, 4);
    assert.equal(cards[0]?.value, 4);
    assert.equal(cards[1]?.value, 3);
  });

  it("WEB-9.2-DASH-03 buildDashboardBookingsKpiCards mirrors command center KPIs", () => {
    const cards = buildDashboardBookingsKpiCards(
      parseDashboardBookingsSummary({
        pending: 5,
        approvedToday: 2,
        departures7d: 1,
        waitlist: 4,
      })
    );
    assert.equal(cards.map((card) => card.value).join(","), "5,2,1,4");
  });

  it("WEB-9.2-DASH-04 selectRecentToursForDashboard and queue chips are bounded", () => {
    const tours = selectRecentToursForDashboard(
      Array.from({ length: 5 }, (_, index) => ({
        id: `t-${index}`,
        tenantId: "tenant",
        createdAt: "",
        updatedAt: "",
        rowVersion: 1,
        title: `Tour ${index}`,
        shortDescription: null,
        listStatus: "active",
        uiStatus: "active" as const,
        priceAmount: null,
        priceCurrency: null,
        totalCapacity: null,
        acceptedCount: 0,
        category: null,
        coverImageUrl: null,
        departureAt: null,
      })),
      3
    );
    assert.equal(tours.length, 3);

    const chips = selectRegistrationQueueChips(
      parseDashboardBookingsSummary({
        pending: 6,
        approvedToday: 0,
        departures7d: 0,
        waitlist: 0,
        tourChips: [
          { tourId: "a", tourTitle: "A", pendingCount: 1, totalCount: 3 },
          { tourId: "b", tourTitle: "B", pendingCount: 5, totalCount: 8 },
          { tourId: "c", tourTitle: "C", pendingCount: 0, totalCount: 2 },
        ],
      }),
      2
    );
    assert.equal(chips.length, 2);
    assert.equal(chips[0]?.tourId, "b");
  });

  it("WEB-9.2-DASH-05 dashboard widget test ids and hrefs are stable", () => {
    assert.equal(DASHBOARD_WIDGETS_TEST_IDS.overview, "dashboard-widget-stats");
    assert.equal(DASHBOARD_WIDGETS_TEST_IDS.toursList, "dashboard-tours-recent-list");
    assert.equal(dashboardToursHref(), "/tours");
    assert.equal(dashboardPendingBookingsHref(), "/bookings?status=pending");
  });
});
