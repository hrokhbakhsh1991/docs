/**
 * P15-W-D2 — urban create wizard smoke (SMK-P15-W-D2)
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
import { expect, test } from "@playwright/test";

import { TOURS_LIST_TEST_IDS } from "../../src/features/tours/query-model";

import {
  clickWizardContinue,
  expectUrbanTourCanonicalTitle,
  fillUrbanWizardReviewPublishStatus,
  fillUrbanWizardTourDetails,
  submitUrbanWizardCreate,
} from "./fixtures/urban-wizard-create-fixture";
import {
  loginUrbanOwner,
  URBAN_OWNER_E2E_BASE_URL,
} from "./fixtures/urban-owner-session";

test.describe("urban-wizard-create.spec.ts — P15-W-D2", () => {
  test.use({ baseURL: URBAN_OWNER_E2E_BASE_URL });
  test.setTimeout(180_000);

  test("SMK-P15-W-D2 urban wizard create → tour in list", async ({ page }) => {
    const tourTitle = `SMK-P15-W-D2 ${Date.now()}`;

    await loginUrbanOwner(page);

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 120_000 });
    await expect(page.locator("[data-workspace-wizard]")).toHaveAttribute("data-plugin-id", "urban");

    await fillUrbanWizardTourDetails(page, { title: tourTitle });
    await clickWizardContinue(page);

    await fillUrbanWizardReviewPublishStatus(page);
    await submitUrbanWizardCreate(page);
    await expectUrbanTourCanonicalTitle(page, tourTitle);

    await page.goto("/tours");
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.page)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId(TOURS_LIST_TEST_IDS.list)).toContainText(tourTitle, {
      timeout: 15_000,
    });
  });
});
