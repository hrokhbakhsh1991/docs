/**
 * Denali itinerary — operator flat edit + wizard smoke (SMK-P9-ITIN-01/02)
 */
import { expect, test } from "@playwright/test";

import {
  advanceWizardToStep,
  DENALI_FLAT_EDIT_SECTION_TEST_ID,
  fillDenaliMultiDayWizardBasics,
  resetOperatorWizardToBasic,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import { DENALI_ITINERARY_TEST_IDS } from "../../src/wizard/denali/denali-itinerary-test-ids";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

test.describe("denali-itinerary-wizard.spec.ts", () => {
  test.setTimeout(180_000);

  test("SMK-P9-ITIN-01 flat edit shows itinerary composite for multi-day smoke tour", async ({
    page,
  }) => {
    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await page.goto(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}/edit`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(DENALI_FLAT_EDIT_SECTION_TEST_ID("denali_program"))).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary)).toBeVisible({
      timeout: 60_000,
    });
    const itinerary = page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary);
    await expect(itinerary.getByRole("textbox", { name: "عنوان روز" }).first()).toHaveValue("Summit push");
    await expect(
      itinerary
        .getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))
        .locator("article")
        .first()
        .getByRole("textbox", { name: "عنوان" })
    ).toHaveValue("Ridge ascent");
  });

  test("SMK-P9-ITIN-02 new tour wizard shows itinerary on program step for multi-day", async ({
    page,
  }) => {
    const tourTitle = `SMK-P9-ITIN-02 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await resetOperatorWizardToBasic(page);

    await fillDenaliMultiDayWizardBasics(page, tourTitle);
    await advanceWizardToStep(page, "denali_photos");
    await advanceWizardToStep(page, "denali_program");

    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))).toBeVisible();
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(2))).toBeVisible();
  });
});
