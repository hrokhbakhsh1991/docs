import { expect, test } from "@playwright/test";
import {
  addLeaderSmokeSessionCookie,
  clearTourWizardLocalDraft,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
  installUrbanWizardE2eSeed,
  smokeTourWizardNewUrl,
  SMOKE_WIZARD_URBAN_E2E_QUERY,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";
/**
 * Cross-profile smoke: `tourType` → `defaultTourFormProfileForTourType("city")` = `urban_event`
 * without a main theme; stepper must omit itinerary / participation / logistics steps.
 * @see `resolveTourFormProfile` + `getVisibleWizardStepsForProfile`
 */
test.describe("tour wizard urban profile (stepper)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await clearTourWizardLocalDraft(page);
    await installUrbanWizardE2eSeed(page);
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page);
    await page.goto(smokeTourWizardNewUrl(baseURL, SMOKE_WIZARD_URBAN_E2E_QUERY), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  });

  test("city tour type hides urban-skipped steps in stepper", async ({ page }) => {
    const w = page.getByTestId("tour-create-wizard");
    await expect(w).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("wizard-form-profile")).toHaveAttribute("data-form-profile", "urban_event", {
      timeout: 15_000,
    });
    const tourTypeSelect = w.locator('select[name="overview.tourType"]');
    await expect(tourTypeSelect).toHaveValue("city", { timeout: 5_000 });

    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه کوتاه برای تست پروفایل شهری",
      longDescription: "توضیح کامل تور برای عبور از اعتبارسنجی گام اول.",
    });

    const stepper = page.getByLabel("مراحل ایجاد تور");
    await expect(stepper).not.toContainText("برنامه سفر", { timeout: 20_000 });
    await expect(stepper).not.toContainText("شرایط شرکت");
    await expect(stepper).not.toContainText("لجستیک");
  });
});
