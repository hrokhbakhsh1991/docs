import { expect, test } from "@playwright/test";
import {
  addLeaderSmokeSessionCookie,
  expectWizardTemplateProfile,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
  installUrbanWizardE2eSeed,
  smokeTourWizardNewUrl,
  SMOKE_WIZARD_SHELL_TEST_ID,
  SMOKE_WIZARD_URBAN_E2E_QUERY,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

/** Workspace template profile for this smoke (wizard shell authority). */
const WORKSPACE_TEMPLATE_PROFILE = "urban_event" as const;

/**
 * Wizard profile is controlled by the workspace template (`urban_event` here).
 * `tourType` may still be seeded for form defaults; it does not change `data-form-profile`.
 */
test.describe("tour wizard urban workspace template (stepper)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installUrbanWizardE2eSeed(page);
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: WORKSPACE_TEMPLATE_PROFILE,
    });
    await page.goto(smokeTourWizardNewUrl(baseURL, SMOKE_WIZARD_URBAN_E2E_QUERY), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
  });

  test("urban template hides inactive steps regardless of tour type seed", async ({ page }) => {
    const w = page.getByTestId(SMOKE_WIZARD_SHELL_TEST_ID);
    await expect(w).toBeVisible({ timeout: 20_000 });
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);

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
