/**
 * Phase 3 — Journey C clone / remint confidence (P3-E2E-C01 / C02).
 *
 * C01: `/tours/new?clone=` hydrates Denali draft with Copy suffix (smoke tour uses
 * https photo URLs → remint plan skips storage copy — still a valid remint path).
 * C02: unknown clone id → clone-error surface; recover by opening a valid clone URL.
 *
 * Storage remint remains non-blocking; Wave 3 adds operator warning banner when
 * remint batches fail (`operator-tour-clone-photo-remint-warning`). Hard-fail
 * policy (block hydrate) is still a product decision.
 *
 * @see TEMP/DENALI_PHASE_3_WAVE2_CLONE_E2E_DESIGN.md
 * @see TEMP/DENALI_PHASE_3_JOURNEY_INVENTORY.md (P3-E2E-C01/C02)
 */
import { expect, test } from "@playwright/test";

import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import { TOUR_CLONE_HYDRATE_TEST_IDS } from "../../src/tours/tour-clone-hydrate-logic";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_PUBLISHED_TOUR_TITLE = "North Ridge Trek";
const CLONE_TITLE = `${OPERATOR_PUBLISHED_TOUR_TITLE} (Copy)`;
const MISSING_TOUR_ID = "00000000-0000-4000-8000-ffffffff0001";

const TITLE_FIELD = /نام تور|^title$/i;

async function prepareCloneSession(page: import("@playwright/test").Page): Promise<void> {
  await loginOperatorOwner(page);
  await publishOperatorWizardTemplate(page, { fullTemplate: true });
}

test.describe("denali-clone-confidence.spec.ts — Phase 3 C01/C02", () => {
  test.setTimeout(180_000);

  test("P3-E2E-C01 clone hydrate succeeds with Copy title", async ({ page }) => {
    await prepareCloneSession(page);
    await page.goto(`/tours/new?clone=${OPERATOR_PUBLISHED_TOUR_ID}`, {
      waitUntil: "domcontentloaded",
    });

    // Loading may flash; must not land on clone-error for a known published tour.
    await expect(page.getByTestId(TOUR_CLONE_HYDRATE_TEST_IDS.error)).toHaveCount(0, {
      timeout: 90_000,
    });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 90_000 });

    const titleField = page.getByRole("textbox", { name: TITLE_FIELD }).first();
    await expect(titleField).toBeVisible({ timeout: 60_000 });
    await expect(titleField).toHaveValue(CLONE_TITLE, { timeout: 30_000 });
  });

  test("P3-E2E-C02 missing clone source shows error; valid clone recovers", async ({ page }) => {
    await prepareCloneSession(page);

    await page.goto(`/tours/new?clone=${MISSING_TOUR_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_CLONE_HYDRATE_TEST_IDS.error)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(TOUR_CLONE_HYDRATE_TEST_IDS.error)).toContainText(
      /TOUR_CLONE_HTTP_404|Could not load tour|بارگذاری/i
    );
    await expect(page.getByTestId("operator-tour-clone-retry")).toBeVisible();
    await expect(page.getByTestId("operator-tour-clone-back")).toBeVisible();

    // Recovery — re-enter with a valid clone id (retry reloads same failing URL).
    await page.goto(`/tours/new?clone=${OPERATOR_PUBLISHED_TOUR_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByTestId(TOUR_CLONE_HYDRATE_TEST_IDS.error)).toHaveCount(0, {
      timeout: 90_000,
    });
    await expect(page.locator("[data-workspace-wizard]")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole("textbox", { name: TITLE_FIELD }).first()).toHaveValue(
      CLONE_TITLE,
      { timeout: 60_000 }
    );
  });
});
