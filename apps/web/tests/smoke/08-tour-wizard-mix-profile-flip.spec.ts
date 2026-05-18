import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  clearTourWizardLocalDraft,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
  purgeTourWizardDraftStorage,
  setNativeSelectValue,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

const THEME_URBAN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const THEME_MOUNTAIN = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const THEME_CINEMA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/**
 * Mix-theme profile flip (فاز ۷.۳.۲): selecting main theme drives `data-form-profile` and stepper.
 * Mirrors `mix-demo` tenant seeds without requiring a dedicated smoke host.
 */
test.describe("tour wizard mix profile flip (stepper)", () => {
  const now = new Date().toISOString();

  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await clearTourWizardLocalDraft(page);
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, {
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
    await purgeTourWizardDraftStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه برای تست flip پروفایل",
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
  }

  test("urban → mountain → cinema updates form profile and stepper", async ({ page }) => {
    await openThemeStep(page);
    const stepper = page.getByLabel("مراحل ایجاد تور");
    const profile = page.getByTestId("wizard-form-profile");

    await selectMainTheme(page, THEME_URBAN);
    await expect(profile).toHaveAttribute("data-form-profile", "urban_event", { timeout: 15_000 });
    await expect(stepper).not.toContainText("برنامه سفر");
    await expect(stepper).not.toContainText("شرایط شرکت");
    await expect(stepper).not.toContainText("لجستیک");

    await selectMainTheme(page, THEME_MOUNTAIN);
    await expect(profile).toHaveAttribute("data-form-profile", "mountain_outdoor", { timeout: 15_000 });
    await expect(stepper).toContainText("برنامه سفر", { timeout: 15_000 });
    await expect(stepper).toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک");

    await selectMainTheme(page, THEME_CINEMA);
    await expect(profile).toHaveAttribute("data-form-profile", "cinema_event", { timeout: 15_000 });
    await expect(stepper).not.toContainText("برنامه سفر");
    await expect(stepper).not.toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک", { timeout: 15_000 });
  });
});
