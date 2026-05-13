import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  clearTourWizardLocalDraft,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  installTourWizardSettingsRoutes,
  setNativeSelectValue,
} from "./tour-wizard-smoke-helpers";

test.describe("tour wizard preset picker filters by resolved form profile", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    await clearTourWizardLocalDraft(page);
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    const now = new Date().toISOString();
    await installTourWizardSettingsRoutes(page, {
      themes: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          name: "سینما preset filter",
          slug: "cinema-preset-filter",
          description: null,
          isActive: true,
          sortOrder: 0,
          formProfile: "cinema_event",
          createdAt: now,
          updatedAt: now,
        },
      ],
      presets: [
        {
          id: "preset-general-only",
          name: "قالب عمومی",
          description: null,
          isActive: true,
          sortOrder: 0,
          matchTourType: null,
          matchMainTourThemeId: null,
          formProfile: "general",
          defaults: {},
          createdAt: now,
          updatedAt: now,
        },
        {
          id: "preset-cinema-only",
          name: "قالب سینما",
          description: null,
          isActive: true,
          sortOrder: 1,
          matchTourType: null,
          matchMainTourThemeId: null,
          formProfile: "cinema_event",
          defaults: { overview: { shortDescription: "از پیش‌فرض سینما" } },
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  });

  test("after cinema theme, basic step preset select lists only matching form_profile", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });

    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه برای تست فیلتر قالب سینما",
      longDescription: "توضیح کامل برای عبور از اعتبارسنجی گام اول.",
    });
    await page.getByRole("button", { name: "بعدی" }).click();

    await expect(page.locator("form h2").first()).toContainText("تم و برچسب", { timeout: 15_000 });
    const mainThemeSelect = page.locator('select[name="overview.mainTourThemeId"]');
    await expect(mainThemeSelect).toBeVisible({ timeout: 10_000 });
    await setNativeSelectValue(mainThemeSelect, "33333333-3333-4333-8333-333333333333");
    await page.getByRole("button", { name: "قبلی" }).click();

    const presetSelect = page.locator("#tour-creation-preset-select");
    await expect(presetSelect).toBeVisible({ timeout: 10_000 });
    const options = presetSelect.locator("option");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveValue("preset-cinema-only");
  });
});
