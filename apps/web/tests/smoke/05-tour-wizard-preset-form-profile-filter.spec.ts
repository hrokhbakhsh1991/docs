import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  clearTourWizardLocalDraft,
  fillTourWizardBasicInfoStep,
  purgeTourWizardDraftStorage,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  installTourWizardSettingsRoutes,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

test.describe("tour wizard preset picker filters by resolved form profile", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await clearTourWizardLocalDraft(page);
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    const now = new Date().toISOString();
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: "cinema_event",
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

  test("cinema workspace template filters preset select by form_profile", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await purgeTourWizardDraftStorage(page);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });

    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه برای تست فیلتر قالب سینما",
      longDescription: "توضیح کامل برای عبور از اعتبارسنجی گام اول.",
    });

    const presetSelect = page.locator("#tour-creation-preset-select");
    await expect(presetSelect).toBeVisible({ timeout: 10_000 });
    const options = presetSelect.locator("option");
    await expect(options).toHaveCount(1);
    await expect(options.first()).toHaveAttribute("value", "preset-cinema-only");
  });
});
