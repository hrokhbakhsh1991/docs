import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  clearTourWizardLocalDraft,
  fillTourWizardBasicInfoStep,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
} from "./tour-wizard-smoke-helpers";

const URBAN_PROFILE_MINIMAL_DRAFT_KEY = "tour-create-wizard-draft-v1";
const URBAN_PROFILE_MINIMAL_DRAFT_JSON = JSON.stringify({
  overview: { tourType: "city" },
});

/**
 * Cross-profile smoke: `tourType` → `defaultTourFormProfileForTourType("city")` = `urban_event`
 * without a main theme; stepper must omit itinerary / participation / logistics steps.
 *
 * Seeds a minimal localStorage draft + second navigation (same timing contract as submit-urban) so profile
 * resolves before assertions. Runtime `?e2eTourType=` / `__E2E_SEED_TOUR_TYPE` remain supported in-app.
 * @see `resolveTourFormProfile` + `getVisibleWizardStepsForProfile`
 */
test.describe("tour wizard urban profile (stepper)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    await clearTourWizardLocalDraft(page);
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page);
  });

  test("city tour type hides urban-skipped steps in stepper", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    const res = await page.goto(`${baseURL}/tours/new`, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await page.evaluate(
      ({ key, json }: { key: string; json: string }) => {
        try {
          localStorage.setItem(key, json);
        } catch {
          /* ignore */
        }
      },
      { key: URBAN_PROFILE_MINIMAL_DRAFT_KEY, json: URBAN_PROFILE_MINIMAL_DRAFT_JSON },
    );
    await page.goto(`${baseURL}/tours/new?e2eTourType=city`, { waitUntil: "domcontentloaded" });
    const draftPeek = await page.evaluate((k) => localStorage.getItem(k), URBAN_PROFILE_MINIMAL_DRAFT_KEY);
    expect(draftPeek, "minimal urban draft must survive second navigation").toContain("city");

    const w = page.getByTestId("tour-create-wizard");
    await expect(w).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("wizard-form-profile")).toHaveAttribute("data-form-profile", "urban_event", {
      timeout: 15_000,
    });

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
