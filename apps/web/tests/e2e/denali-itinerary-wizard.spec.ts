/**
 * Denali itinerary — operator flat edit + wizard smoke (SMK-P9-ITIN-01/02)
 */
import { expect, test } from "@playwright/test";

import {
  DENALI_FLAT_EDIT_SECTION_TEST_ID,
  fillDenaliMultiDayWizardBasics,
  fillDenaliMultiDayWizardThroughLegal,
  fillDenaliMultiDayWizardThroughReview,
  fillDenaliWizardPhotosMinimal,
  fillDenaliWizardProgramMinimal,
  resetOperatorWizardToBasic,
  submitDenaliWizardDraftCreate,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import { DENALI_ITINERARY_TEST_IDS } from "@app-tour/workspace-denali/host/ui/test-ids/denali-itinerary-test-ids";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

test.describe("denali-itinerary-wizard.spec.ts", () => {
  test.setTimeout(300_000);

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
    await fillDenaliWizardPhotosMinimal(page);

    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.dayNav(1))).toBeVisible();
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.dayNav(2))).toBeVisible();
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))).toBeVisible();
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(2))).toHaveCount(0);
  });

  test("SMK-P9-ITIN-03 multi-day wizard advances from program to logistics", async ({ page }) => {
    const tourTitle = `SMK-P9-ITIN-03 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await resetOperatorWizardToBasic(page);
    await fillDenaliMultiDayWizardBasics(page, tourTitle);
    await fillDenaliWizardPhotosMinimal(page);
    await fillDenaliWizardProgramMinimal(page);

    await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("denali-composite-transport")).toBeVisible({ timeout: 15_000 });
  });

  test("SMK-P9-ITIN-04 multi-day wizard reaches legal step (tenant template rail)", async ({
    page,
  }) => {
    const tourTitle = `SMK-P9-ITIN-04 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await resetOperatorWizardToBasic(page);
    await fillDenaliMultiDayWizardThroughLegal(page, tourTitle);
    await expect(page.locator('[data-wizard-step="denali_legal"]')).toBeVisible();
  });

  test("SMK-P9-ITIN-05 multi-day wizard creates draft tour end-to-end", async ({ page }) => {
    const tourTitle = `SMK-P9-ITIN-05 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });

    await resetOperatorWizardToBasic(page);
    await fillDenaliMultiDayWizardThroughReview(page, tourTitle);
    await submitDenaliWizardDraftCreate(page);
  });

  test("SMK-P9-ITIN-06 back and next preserve multi-day basic values", async ({ page }) => {
    const tourTitle = `SMK-P9-ITIN-06 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });
    await fillDenaliMultiDayWizardBasics(page, tourTitle);

    await expect(page.locator("[data-wizard-step=\"denali_photos\"]")).toBeVisible();
    await page.getByTestId("workspace-wizard-step-back").click();
    await expect(page.locator("[data-wizard-step=\"denali_basic\"]")).toBeVisible();
    await expect(page.getByRole("textbox", { name: /نام تور|title/i })).toHaveValue(tourTitle);
    await expect(page.getByTestId("denali-tour-kind-category-mountain")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByTestId("denali-tour-kind-duration-multi_day")).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.getByTestId("workspace-wizard-step-next").click();
    await expect(page.locator("[data-wizard-step=\"denali_photos\"]")).toBeVisible();
  });

  test("SMK-P9-ITIN-07 empty validation is localized without missing-message errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });
    await resetOperatorWizardToBasic(page);
    await page.getByTestId("workspace-wizard-step-next").click();

    const body = page.locator("body");
    await expect(body).not.toContainText("No value at canonical path");
    await expect(body).not.toContainText("denali.composites.datetime.sectionTitle");
    expect(consoleErrors.join("\n")).not.toMatch(/MISSING_MESSAGE|composites\.datetime\.sectionTitle/);
  });

  test("SMK-P9-ITIN-08 draft failure reaches ERROR and retry succeeds", async ({ page }) => {
    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });
    await resetOperatorWizardToBasic(page);

    const failDraftPatch = async (route: import("@playwright/test").Route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { code: "TEST_DRAFT_UNAVAILABLE" } }),
        });
        return;
      }
      await route.continue();
    };
    await page.route("**/api/workspaces/**/drafts/**", failDraftPatch);

    await page.getByRole("textbox", { name: /نام تور|title/i }).fill("Draft retry proof");
    const indicator = page.getByTestId("draft-sync-indicator");
    await expect(indicator).toHaveAttribute("data-status", "ERROR", { timeout: 15_000 });
    await expect(page.getByTestId("draft-sync-retry")).toBeVisible();

    await page.unroute("**/api/workspaces/**/drafts/**", failDraftPatch);
    await page.getByTestId("draft-sync-retry").click();
    await expect
      .poll(() => indicator.getAttribute("data-status"), { timeout: 30_000 })
      .toMatch(/^(?:IDLE|SAVED)$/);
  });

  test("SMK-P9-ITIN-09 multi-day itinerary preserves day data across navigation", async ({
    page,
  }) => {
    const tourTitle = `SMK-P9-ITIN-09 ${Date.now()}`;

    await loginOperatorOwner(page);
    await publishOperatorWizardTemplate(page, { fullTemplate: true });
    await resetOperatorWizardToBasic(page);
    await fillDenaliMultiDayWizardBasics(page, tourTitle);
    await fillDenaliWizardPhotosMinimal(page);

    const itinerary = page.getByTestId(DENALI_ITINERARY_TEST_IDS.itinerary);
    await expect(itinerary).toBeVisible({ timeout: 30_000 });

    await itinerary.getByTestId(DENALI_ITINERARY_TEST_IDS.dayNav(1)).click();
    await itinerary
      .getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))
      .getByRole("textbox", { name: /عنوان روز|Day title/i })
      .fill("Day one proof");
    await itinerary
      .getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))
      .getByRole("textbox", { name: /^عنوان$|^Title$/i })
      .first()
      .fill("Day one activity");

    await itinerary.getByTestId(DENALI_ITINERARY_TEST_IDS.dayNav(2)).click();
    await expect(page.getByTestId(DENALI_ITINERARY_TEST_IDS.day(2))).toBeVisible();
    await itinerary
      .getByTestId(DENALI_ITINERARY_TEST_IDS.day(2))
      .getByRole("textbox", { name: /عنوان روز|Day title/i })
      .fill("Day two proof");

    await itinerary.getByTestId(DENALI_ITINERARY_TEST_IDS.dayNav(1)).click();
    await expect(
      itinerary
        .getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))
        .getByRole("textbox", { name: /عنوان روز|Day title/i })
    ).toHaveValue("Day one proof");
    await expect(
      itinerary
        .getByTestId(DENALI_ITINERARY_TEST_IDS.day(1))
        .getByRole("textbox", { name: /^عنوان$|^Title$/i })
        .first()
    ).toHaveValue("Day one activity");
  });
});
