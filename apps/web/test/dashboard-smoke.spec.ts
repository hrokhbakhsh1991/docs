/**
 * Phase 9.2 — dashboard smoke
 * Authority: docs/phase-9/subphases/9.2-admin-shell.md · REQ-P9-020
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  DASHBOARD_GRID_TEST_ID,
  DASHBOARD_WIDGET_REGISTRY,
  FINANCE_DASHBOARD_WIDGET_DESCRIPTOR,
} from "../src/admin/dashboard/dashboard-widget-registry";
import { resolveOperatorNav } from "../src/admin/shell/resolve-operator-nav";
import { OPERATOR_NAV_TEST_IDS } from "../src/admin/shell/operator-nav.types";
import { OPERATOR_WELCOME_TEST_IDS } from "../src/admin/onboarding/operator-welcome-types";
import { ensureFinanceNavSupported } from "../src/finance/finance-nav-enablement";
import { shouldShowFinanceDashboardWidget } from "../src/finance/finance-dashboard-widget-logic";

const OWNER_SESSION = {
  userId: "00000000-0000-4000-8000-000000000101",
  tenantId: "00000000-0000-4000-8000-000000000014",
  role: "owner" as const,
  workspaceType: "denali",
};

describe("dashboard-smoke.spec.ts — Phase 9.2", () => {
  it("WEB-9.2-02 shell exposes nav and main landmarks", () => {
    assert.equal(OPERATOR_NAV_TEST_IDS.nav, "operator-nav");
    assert.equal(OPERATOR_NAV_TEST_IDS.main, "operator-main");
    assert.equal(OPERATOR_NAV_TEST_IDS.menuToggle, "operator-menu-toggle");
  });

  it("WEB-9.2-02b shell restores persisted sidebar preference after mount", () => {
    const shellSource = readFileSync("src/admin/shell/operator-shell.tsx", "utf8");
    const shellCss = readFileSync(
      "../../packages/design-tokens/src/operator-shell-structure.css",
      "utf8"
    );

    assert.match(shellSource, /operator-sidebar-collapsed/);
    assert.match(shellSource, /readStoredSidebarCollapsed/);
    assert.match(shellSource, /data-operator-sidebar-ready/);
    assert.doesNotMatch(shellSource, /suppressHydrationWarning/);
    assert.match(shellCss, /data-operator-sidebar-ready="false"/);
  });

  it("WEB-9.2-06 dashboard widget registry renders grid landmarks", () => {
    assert.equal(DASHBOARD_GRID_TEST_ID, "operator-dashboard-grid");
    assert.ok(DASHBOARD_WIDGET_REGISTRY.length >= 3);
    assert.equal(DASHBOARD_WIDGET_REGISTRY[0]?.testId, "dashboard-widget-stats");
  });

  it("WEB-DASH-ATTN-04 dashboard renders attention section before generic widgets", () => {
    const page = readFileSync("app/(app)/dashboard/dashboard-page-client.tsx", "utf8");
    const attentionIndex = page.indexOf("<DashboardAttentionSection");
    const gridIndex = page.indexOf("data-operator-dashboard-grid");
    assert.ok(attentionIndex > 0);
    assert.ok(gridIndex > attentionIndex);
    assert.match(page, /buildDashboardAttentionItems/);
  });

  it("WEB-DASH-MOBILE-01 dashboard prioritizes action widgets before generic cards on mobile", () => {
    const page = readFileSync("app/(app)/dashboard/dashboard-page-client.tsx", "utf8");
    const skin = readFileSync(
      "../../packages/workspaces/denali/theme/admin-skin.css",
      "utf8"
    );
    assert.match(page, /order-1 md:order-none md:col-span-1 xl:col-span-6/);
    assert.match(page, /order-2 md:order-none md:col-span-2 xl:col-span-6/);
    assert.match(page, /order-4 md:order-none xl:col-span-4/);
    assert.match(skin, /@media \(max-width: 639px\)/);
    assert.match(skin, /\[data-operator-dashboard-widget\][\s\S]*?min-height: 0/);
    assert.match(skin, /\[data-operator-dashboard-kpi-grid\][\s\S]*?grid-template-columns: minmax\(0, 1fr\)/);
    assert.match(skin, /\[data-operator-dashboard-tour-row-link\][\s\S]*?-webkit-line-clamp: 2/);
  });

  it("WEB-9.2-08 finance nav hidden on urban plugin", async () => {
    await ensureFinanceNavSupported("denali");
    await ensureFinanceNavSupported("urban");
    const denaliNav = resolveOperatorNav({ session: OWNER_SESSION, pluginId: "denali" });
    const urbanNav = resolveOperatorNav({ session: OWNER_SESSION, pluginId: "urban" });
    assert.deepEqual(denaliNav.slice(0, 3).map((item) => item.href), [
      "/dashboard",
      "/tours",
      "/bookings",
    ]);
    assert.ok(denaliNav.some((item) => item.pathKey === "finance"));
    assert.equal(
      urbanNav.some((item) => item.pathKey === "finance"),
      false
    );
  });

  it("WEB-9.2-09 welcome dialog landmarks for operator-smoke E2E", () => {
    assert.equal(OPERATOR_WELCOME_TEST_IDS.dialog, "operator-welcome-dialog");
    assert.equal(OPERATOR_WELCOME_TEST_IDS.dismissCta, "operator-welcome-dismiss-cta");
  });

  it("WEB-9.7-DASH-05 finance dashboard widget gated like finance nav", async () => {
    await ensureFinanceNavSupported("denali");
    await ensureFinanceNavSupported("urban");
    assert.equal(shouldShowFinanceDashboardWidget("denali", "owner"), true);
    assert.equal(shouldShowFinanceDashboardWidget("urban", "owner"), false);
    assert.equal(FINANCE_DASHBOARD_WIDGET_DESCRIPTOR.testId, "dashboard-widget-finance");
    assert.equal(DASHBOARD_WIDGET_REGISTRY.some((widget) => widget.id === "finance"), false);
  });
});
