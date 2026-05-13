import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  clearTourWizardLocalDraft,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
  setNativeSelectValue,
} from "./tour-wizard-smoke-helpers";

/**
 * Theme-bound `cinema_event`: same strip as urban for itinerary + participation, but **logistics**
 * stays active (`fieldGroups.getInactiveFieldGroupsForProfile`).
 * @see `prompt.md` §17 (E2E cross-profile).
 */
test.describe("tour wizard cinema theme profile (stepper)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    await clearTourWizardLocalDraft(page);
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);

    const now = new Date().toISOString();
    await installTourWizardSettingsRoutes(page, {
      themes: [
        {
          id: "33333333-3333-4333-8333-333333333333",
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

  test("selecting cinema theme hides itinerary and participation but keeps logistics in stepper", async ({
    page,
  }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });

    await fillTourWizardBasicInfoStep(page, {
      title: "abcdefghijabcdefghij",
      shortDescription: "خلاصه برای تست پروفایل سینما",
      longDescription: "توضیح کامل برای عبور از اعتبارسنجی گام اول.",
    });

    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText("تم و برچسب", { timeout: 15_000 });

    const mainThemeSelect = page.locator('select[name="overview.mainTourThemeId"]');
    await expect(mainThemeSelect).toBeVisible({ timeout: 10_000 });
    await setNativeSelectValue(mainThemeSelect, "33333333-3333-4333-8333-333333333333");

    const stepper = page.getByLabel("مراحل ایجاد تور");
    await expect(stepper).not.toContainText("برنامه سفر", { timeout: 8000 });
    await expect(stepper).not.toContainText("شرایط شرکت");
    await expect(stepper).toContainText("لجستیک");
  });
});
