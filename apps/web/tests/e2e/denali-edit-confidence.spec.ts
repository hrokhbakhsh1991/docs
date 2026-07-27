/**
 * Phase 3 — Journey B edit confidence (P3-E2E-B01).
 *
 * Hydrate → modify → save → reload persistence on Denali flat-edit.
 * Mutates optional `localGuideName` on the operator smoke published tour so
 * catalog title / booking labels (North Ridge Trek) stay intact.
 *
 * @see TEMP/DENALI_PHASE_3_WAVE2_EDIT_E2E_DESIGN.md
 * @see TEMP/DENALI_PHASE_3_JOURNEY_INVENTORY.md (P3-E2E-B01)
 */
import { expect, test } from "@playwright/test";

import { DENALI_FLAT_EDIT_SECTION_TEST_ID } from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import { TOUR_EDIT_TEST_IDS } from "../../src/features/tours/operator-tour-detail-types";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const OPERATOR_PUBLISHED_TOUR_TITLE = "North Ridge Trek";
/** Mirrors DENALI_FLAT_EDIT_VALIDATION_TEST_IDS.list — avoid deep package import in Playwright. */
const FLAT_EDIT_VALIDATION_LIST = "denali-flat-edit-validation-list";

const LOCAL_GUIDE_FIELD = /localGuideName|Local guide name|نام راهنمای محلی/i;
const TITLE_FIELD = /نام تور|^title$/i;

async function openPublishedFlatEdit(
  page: import("@playwright/test").Page
): Promise<void> {
  await loginOperatorOwner(page);
  await publishOperatorWizardTemplate(page, { fullTemplate: true });
  await page.goto(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}/edit`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId(TOUR_EDIT_TEST_IDS.page)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(DENALI_FLAT_EDIT_SECTION_TEST_ID("denali_basic"))).toBeVisible({
    timeout: 60_000,
  });
}

async function fillLocalGuideName(
  page: import("@playwright/test").Page,
  value: string
): Promise<void> {
  const field = page.getByRole("textbox", { name: LOCAL_GUIDE_FIELD });
  await expect(field).toBeVisible({ timeout: 30_000 });
  await field.fill(value);
}

async function clickSaveAndWait(
  page: import("@playwright/test").Page
): Promise<void> {
  const patchResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/tours/${OPERATOR_PUBLISHED_TOUR_ID}`) &&
      response.request().method() === "PATCH" &&
      response.ok()
  );
  await page.getByTestId(TOUR_EDIT_TEST_IDS.save).click();
  await patchResponse;
  await expect(page.getByText(/Changes saved\.|تغییرات ذخیره شد\./i)).toBeVisible({
    timeout: 20_000,
  });
}

test.describe("denali-edit-confidence.spec.ts — Phase 3 B01", () => {
  test.setTimeout(180_000);

  test("P3-E2E-B01 hydrate → edit localGuideName → save → reload persists", async ({
    page,
  }) => {
    const guideName = `P3-B01 Guide ${Date.now()}`;

    await openPublishedFlatEdit(page);
    await fillLocalGuideName(page, guideName);
    await clickSaveAndWait(page);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(DENALI_FLAT_EDIT_SECTION_TEST_ID("denali_basic"))).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole("textbox", { name: LOCAL_GUIDE_FIELD })).toHaveValue(guideName, {
      timeout: 30_000,
    });

    // Cleanup — leave optional field empty for later suites.
    await fillLocalGuideName(page, "");
    await clickSaveAndWait(page);
  });

  test("P3-E2E-B01-F validation blocks empty title; title restored", async ({ page }) => {
    await openPublishedFlatEdit(page);

    const titleField = page.getByRole("textbox", { name: TITLE_FIELD }).first();
    await expect(titleField).toBeVisible({ timeout: 30_000 });
    await expect(titleField).toHaveValue(OPERATOR_PUBLISHED_TOUR_TITLE);

    await titleField.fill("");
    await page.getByTestId(TOUR_EDIT_TEST_IDS.save).click();

    await expect(page.getByTestId(FLAT_EDIT_VALIDATION_LIST)).toBeVisible({
      timeout: 20_000,
    });

    await titleField.fill(OPERATOR_PUBLISHED_TOUR_TITLE);
    await clickSaveAndWait(page);
    await expect(page.getByRole("textbox", { name: TITLE_FIELD }).first()).toHaveValue(
      OPERATOR_PUBLISHED_TOUR_TITLE
    );
  });
});
