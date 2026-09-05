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

  test("ITO-B01 EN desktop — operations tab loads manifest desk", async ({ page }) => {
    await openOperationsTab(page);
    await expect(page.getByTestId("ito-execution-state")).toBeVisible();
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.tabOperations)).toBeVisible();
    await expect(page.getByTestId("ito-checklist-list")).toBeVisible();
  });

  test("ITO-B02 lock manifest from draft when approved rows exist", async ({ page }) => {
    await openOperationsTab(page);
    const lockButton = page.getByTestId("ito-lock-manifest");
    if (await lockButton.isEnabled()) {
      await lockButton.click();
      await expect(page.getByTestId("ito-execution-state")).toHaveText(
        /manifest_locked|pre_tour|in_progress/,
      );
    }
    await expect(page.getByTestId("ito-checklist-list")).toBeVisible();
  });

  test("ITO-B03 checklist toggle and operational event", async ({ page }) => {
    await openOperationsTab(page);
    const toggle = page.getByTestId("ito-checklist-toggle").first();
    if (await toggle.isVisible()) {
      await toggle.click();
    }
    const eventInput = page.getByTestId("ito-event-description");
    await eventInput.fill(`ITO smoke event ${Date.now()}`);
    await page.getByTestId("ito-log-event").click();
    await expect(page.getByTestId("ito-event-row").first()).toBeVisible();
  });

  test("ITO-B04 FA mobile viewport — operations panel renders", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
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
  });
});
