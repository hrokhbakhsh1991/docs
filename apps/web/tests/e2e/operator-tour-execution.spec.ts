/**
 * ITO-001 — operator tour execution desk (browser).
 */
import { expect, test, type Page } from "@playwright/test";

import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

/** Denali smoke tenant published tour (tenant …000003) — not operator …0210 on …014. */
const DENALI_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";
const TOUR_ID = process.env.QA_TOUR_ID?.trim() || DENALI_SMOKE_PUBLISHED_TOUR_ID;

async function openOperationsTab(page: Page): Promise<void> {
  await page.goto(`/tours/${encodeURIComponent(TOUR_ID)}/workspace?tab=operations`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.operationsPanel)).toBeVisible({
    timeout: 120_000,
  });
}

test.describe("operator-tour-execution.spec.ts — ITO-001 operations tab", () => {
  test.beforeEach(async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE);
  });

  test("ITO-B01 EN desktop — manifest-first desk without optional panels", async ({ page }) => {
    await openOperationsTab(page);
    await expect(page.getByTestId("ito-execution-state")).toBeVisible();
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabOperations)).toBeVisible();
    await expect(page.getByTestId("ito-manifest-table").or(page.getByTestId("ito-manifest-list")).or(page.getByTestId("ito-manifest-empty"))).toBeVisible();
    await expect(page.getByTestId("ito-checklist-panel")).toHaveCount(0);
    await expect(page.getByTestId("ito-groups-panel")).toHaveCount(0);
    await expect(page.getByTestId("ito-events-panel")).toHaveCount(0);
  });

  test("ITO-B02 lock manifest from draft when approved rows exist", async ({ page }) => {
    await openOperationsTab(page);
    const lockButton = page.getByTestId("ito-lock-manifest");
    if ((await lockButton.count()) > 0 && (await lockButton.isEnabled())) {
      await lockButton.click();
      await expect(page.getByTestId("ito-execution-state")).not.toHaveText(/draft/i);
    }
    await expect(
      page.getByTestId("ito-manifest-table").or(page.getByTestId("ito-manifest-list")).or(page.getByTestId("ito-manifest-empty")),
    ).toBeVisible();
  });

  test("ITO-B03 attendance actions on manifest row", async ({ page }) => {
    await openOperationsTab(page);
    const presentButton = page.getByTestId("ito-mark-present").first();
    if (await presentButton.isVisible()) {
      await presentButton.click();
      await expect(page.getByTestId("ito-action-notice").or(page.getByTestId("ito-attendance-status"))).toBeVisible();
    } else {
      await expect(page.getByTestId("ito-manifest-empty")).toBeVisible();
    }
  });

  test("ITO-B04 FA mobile viewport — operations panel renders", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.context().addCookies([
      {
        name: "NEXT_LOCALE",
        value: "fa",
        domain: "admin.denali.localhost",
        path: "/",
      },
    ]);
    await openOperationsTab(page);
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.operationsPanel)).toBeVisible();
    await expect(page.getByTestId("ito-execution-state")).toBeVisible();
    await expect(page.getByTestId("ito-manifest-list").or(page.getByTestId("ito-manifest-empty"))).toBeVisible();
  });
});
