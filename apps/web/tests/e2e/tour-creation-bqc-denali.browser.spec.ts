/**
 * BQC — Denali admin tour creation state matrix (TC-TOUR-01..05).
 */
import { expect, test } from "@playwright/test";

import { DENALI_ITINERARY_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-itinerary-test-ids";
import { WIZARD_STEP_SHELL_TEST_IDS } from "../../src/wizard/wizard-step-shell-logic";
import {
  DENALI_DEV_DEFAULT_DESTINATION_LABEL,
  fillDenaliMultiDayWizardBasics,
  fillDenaliMultiDayWizardThroughReview,
  fillDenaliWizardPhotosMinimal,
  resetOperatorWizardToBasic,
  submitDenaliWizardDraftCreate,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";
import {
  openFlatEditForTour,
  publishTourFromFlatEdit,
} from "../../test/fixtures/tour-creation-publication-fixture";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import { loginDenaliOperatorOwner } from "./fixtures/authenticate-denali-operator-for-engagement";

async function captureTourArtifact(page: import("@playwright/test").Page, path: string): Promise<void> {
  try {
    await page.screenshot({ path, fullPage: true });
  } catch (error) {
    console.warn(`Tour BQC artifact screenshot skipped (${path}):`, error);
  }
}

async function prepareDenaliAdminWizard(page: import("@playwright/test").Page) {
  await loginDenaliOperatorOwner(page);
  await publishOperatorWizardTemplate(page, { fullTemplate: true });
  await resetOperatorWizardToBasic(page);
}

test.describe("BQC Denali tour creation — TC-TOUR", () => {
  test.setTimeout(300_000);

  test("TC-TOUR-01 wizard basic step — multi-day mountain + locked peak", async ({ page }) => {
    const title = `TC-TOUR-01 ${Date.now()}`;
    await prepareDenaliAdminWizard(page);
    await fillDenaliMultiDayWizardBasics(page, title, DENALI_DEV_DEFAULT_DESTINATION_LABEL);
    await expect(page.locator('[data-wizard-step="denali_photos"]')).toBeVisible();
    await captureTourArtifact(page, "/opt/cursor/artifacts/tour-01-multiday-basics.png");
  });

  test("TC-TOUR-02 program step — itinerary days visible", async ({ page }) => {
    const title = `TC-TOUR-02 ${Date.now()}`;
    await prepareDenaliAdminWizard(page);
    await fillDenaliMultiDayWizardBasics(page, title, DENALI_DEV_DEFAULT_DESTINATION_LABEL);
    await fillDenaliWizardPhotosMinimal(page);
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary)).toBeVisible({
      timeout: 30_000,
    });
    await captureTourArtifact(page, "/opt/cursor/artifacts/tour-02-itinerary-program.png");
  });

  test("TC-TOUR-03 back/next preserves title", async ({ page }) => {
    const title = `TC-TOUR-03 ${Date.now()}`;
    await prepareDenaliAdminWizard(page);
    await fillDenaliMultiDayWizardBasics(page, title, DENALI_DEV_DEFAULT_DESTINATION_LABEL);
    await page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.back).click();
    await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible();
    const titleField = page.getByRole("textbox", { name: /نام تور|tour name|^title$/i });
    await expect(titleField).toHaveValue(title);
    await captureTourArtifact(page, "/opt/cursor/artifacts/tour-03-back-preserves-title.png");
  });

  test("TC-TOUR-04 draft create → flat edit → publish", async ({ page }) => {
    const title = `TC-TOUR-04 ${Date.now()}`;
    await prepareDenaliAdminWizard(page);
    await fillDenaliMultiDayWizardThroughReview(page, title, DENALI_DEV_DEFAULT_DESTINATION_LABEL);
    const tourId = await submitDenaliWizardDraftCreate(page);
    await openFlatEditForTour(page, tourId);
    await expect(page.getByRole("textbox", { name: /نام تور|tour name|^title$/i })).toHaveValue(
      title,
    );
    await captureTourArtifact(page, "/opt/cursor/artifacts/tour-04-draft-flat-edit.png");
    await publishTourFromFlatEdit(page, tourId);
    await expect(page.locator('[data-tour-status="active"]')).toBeVisible({ timeout: 30_000 });
    await captureTourArtifact(page, "/opt/cursor/artifacts/tour-04-published.png");
  });

  test("TC-TOUR-05 validation — cannot advance from basic without title", async ({ page }) => {
    await prepareDenaliAdminWizard(page);
    const mountain = page.getByTestId("denali-tour-kind-category-mountain");
    const multiDay = page.getByTestId("denali-tour-kind-duration-multi_day");
    await mountain.click();
    await multiDay.click();
    const next = page.getByTestId(WIZARD_STEP_SHELL_TEST_IDS.next);
    await next.click();
    await expect(page.locator('[data-wizard-step="denali_basic"]')).toBeVisible();
    await expect(page.locator('[data-wizard-step="denali_photos"]')).toHaveCount(0);
    await captureTourArtifact(page, "/opt/cursor/artifacts/tour-05-basic-validation-blocks-advance.png");
  });
});
