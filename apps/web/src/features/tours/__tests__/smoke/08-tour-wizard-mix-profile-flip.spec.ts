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

const THEME_URBAN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THEME_MOUNTAIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THEME_CINEMA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/** Fixed workspace template; theme rows carry other profiles but must not flip the wizard shell. */
const WORKSPACE_TEMPLATE_PROFILE = "mountain_outdoor" as const;

/**
 * Wizard profile is controlled by the workspace template.
 * Main-theme selection must not change `data-form-profile` or template-driven stepper visibility.
 */
test.describe("tour wizard theme selection (profile stable)", () => {
  const now = new Date().toISOString();

  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: WORKSPACE_TEMPLATE_PROFILE,
      themes: [
        {
          id: THEME_URBAN,
          name: "رویداد شهری",
          slug: "mix-smoke-urban",
          description: null,
          isActive: true,
          sortOrder: 10,
          formProfile: "urban_event",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: THEME_MOUNTAIN,
          name: "کوهنوردی",
          slug: "mix-smoke-mountain",
          description: null,
          isActive: true,
          sortOrder: 20,
          formProfile: "mountain_outdoor",
          createdAt: now,
          updatedAt: now,
        },
        {
          id: THEME_CINEMA,
          name: "جلسه کوتاه",
          slug: "mix-smoke-cinema",
          description: null,
          isActive: true,
          sortOrder: 30,
          formProfile: "cinema_event",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  });

  async function openThemeStep(page: import("@playwright/test").Page): Promise<void> {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);
    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه برای تست انتخاب تم",
      longDescription: "توضیح کامل برای عبور از اعتبارسنجی گام اول.",
    });
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText("تم و برچسب", { timeout: 15_000 });
  }

  async function selectMainTheme(page: import("@playwright/test").Page, themeId: string): Promise<void> {
    const mainThemeSelect = page.locator('select[name="overview.mainTourThemeId"]');
    await expect(mainThemeSelect).toBeVisible({ timeout: 10_000 });
    await setNativeSelectValue(mainThemeSelect, themeId);
    await mainThemeSelect.dispatchEvent("change");
    await expect(mainThemeSelect).toHaveValue(themeId);
  }

  test("switching main theme does not change workspace template profile or stepper", async ({ page }) => {
    await openThemeStep(page);
    const stepper = page.getByLabel("مراحل ایجاد تور");

    await selectMainTheme(page, THEME_URBAN);
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);
    await expect(stepper).toContainText("برنامه سفر", { timeout: 15_000 });
    await expect(stepper).toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک");

    await selectMainTheme(page, THEME_MOUNTAIN);
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);
    await expect(stepper).toContainText("برنامه سفر");
    await expect(stepper).toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک");

    await selectMainTheme(page, THEME_CINEMA);
    await expectWizardTemplateProfile(page, WORKSPACE_TEMPLATE_PROFILE);
    await expect(stepper).toContainText("برنامه سفر");
    await expect(stepper).toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک");
  });
});
