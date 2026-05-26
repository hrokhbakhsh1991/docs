import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  expectWizardTemplateProfile,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
  setNativeSelectValue,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

const THEME_CINEMA = "33333333-3333-4333-8333-333333333333";
/** Workspace template profile for this smoke (wizard shell authority). */
const WORKSPACE_TEMPLATE_PROFILE = "cinema_event" as const;

/**
 * Wizard profile is controlled by the workspace template (`cinema_event` here).
 * Selecting a cinema theme updates overview fields only; it does not change `data-form-profile`.
 */
test.describe("tour wizard cinema workspace template (stepper)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);

    const now = new Date().toISOString();
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: WORKSPACE_TEMPLATE_PROFILE,
      themes: [
        {
          id: THEME_CINEMA,
          name: "سینما smoke",
          slug: "cinema-smoke",
          description: null,
          isActive: true,
          sortOrder: 0,
          formProfile: "cinema_event",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  });

  test("cinema template stepper stays stable when main theme is selected", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);

    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه برای تست پروفایل سینما",
      longDescription: "توضیح کامل برای عبور از اعتبارسنجی گام اول.",
    });

    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText("تم و برچسب", { timeout: 15_000 });

    const mainThemeSelect = page.locator('select[name="overview.mainTourThemeId"]');
    await expect(mainThemeSelect).toBeVisible({ timeout: 10_000 });
    await setNativeSelectValue(mainThemeSelect, THEME_CINEMA);
    await mainThemeSelect.dispatchEvent("change");
    await expect(mainThemeSelect).toHaveValue(THEME_CINEMA);
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);

    const stepper = page.getByLabel("مراحل ایجاد تور");
    await expect(stepper).not.toContainText("برنامه سفر", { timeout: 15_000 });
    await expect(stepper).not.toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک", { timeout: 15_000 });
  });
});
