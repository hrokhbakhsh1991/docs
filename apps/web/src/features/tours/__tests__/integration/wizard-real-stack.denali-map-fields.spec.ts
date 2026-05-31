import { expect, test } from "@playwright/test";

import type { DenaliTourKind } from "@repo/types";

import {
  advanceDenaliWizardToReview,
  createDenaliTourViaApi,
  ensureActiveEquipment,
  fetchTourThemes,
  resolveDenaliIntegrationTheme,
  fetchTourTripDetails,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  openDenaliCreateWizardWithFormPatch,
  ownerPhoneFromProject,
  submitWizardAndExpectTourList,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

async function openDenaliProgramStep(
  page: import("@playwright/test").Page,
  tourType: DenaliTourKind,
  theme?: { id: string; name: string; formProfile: string; slug?: string },
  titleSuffix?: string,
): Promise<void> {
  const slug = "denali";
  const runId = titleSuffix ?? `program-${Date.now()}`;
  const location = await fetchWizardLocationIds(page);
  await openDenaliCreateWizardWithFormPatch(page, location, `${slug}-${runId}`, {
    tourType,
    mainTourThemeId: theme?.id,
  });

  const w = page.getByTestId("workspace-tour-wizard");
  await page.getByRole("button", { name: /Next|بعدی/ }).click();
  await expect(page.locator("form h2").first()).toContainText(/برنامه/, { timeout: 20_000 });
  if (theme) {
    const themeCheckbox = w.getByTestId(`denali-theme-select-${(theme as { slug?: string }).slug ?? theme.id}`);
    if (await themeCheckbox.isVisible().catch(() => false)) {
      await themeCheckbox.check();
    }
  }
}

test.describe("real-stack denali map fields (altitude, itinerary, gear)", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test.beforeEach(async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    if (slug !== "denali") {
      test.skip(true, "denali project only");
    }
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));
  });

  test("mountain_day program step shows altitude field", async ({ page }) => {
    const runId = `map-altitude-visible-${Date.now()}`;
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme, "mountain theme (slug or denali_pilot/mountain_outdoor)").toBeTruthy();

    await openDenaliProgramStep(page, "mountain_day", theme!, runId);

    const w = page.getByTestId("workspace-tour-wizard");
    await expect(w.getByTestId("denali-program-altitude")).toBeVisible({ timeout: 10_000 });
  });

  test("mountain_day with nature_trip theme still shows altitude (category-driven)", async ({ page }) => {
    const runId = `map-altitude-category-${Date.now()}`;
    const themes = await fetchTourThemes(page);
    const natureTheme = themes.find((t) => t.formProfile === "nature_trip");
    test.skip(!natureTheme, "workspace has no nature_trip theme");

    await openDenaliProgramStep(page, "mountain_day", natureTheme!, runId);

    const w = page.getByTestId("workspace-tour-wizard");
    await expect(w.getByTestId("denali-program-altitude")).toBeVisible({ timeout: 10_000 });
  });

  test("mountain_multi program step shows three daily itinerary fields", async ({ page }) => {
    const runId = `map-itinerary-${Date.now()}`;
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-multi-day", "denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme, "mountain multi theme").toBeTruthy();

    await openDenaliProgramStep(page, "mountain_multi", theme!, runId);

    const w = page.getByTestId("workspace-tour-wizard");
    await expect(w.getByTestId("denali-daily-itinerary")).toBeVisible({ timeout: 10_000 });
    await expect(w.locator('[data-testid^="denali-itinerary-day-"]')).toHaveCount(3, {
      timeout: 15_000,
    });
  });

  test("logistics step shows gear list when workspace has equipment", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-gear-ui-${Date.now()}`;
    const gear = await ensureActiveEquipment(page);
    const location = await fetchWizardLocationIds(page);
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme).toBeTruthy();

    await openDenaliCreateWizardWithFormPatch(page, location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: theme!.id,
      gearItems: [{ id: gear.id, isRequired: true }],
    });

    await page.getByRole("button", { name: /Next|بعدی/ }).click();
    await expect(page.locator("form h2").first()).toContainText(/برنامه/, { timeout: 20_000 });
    await page.getByRole("button", { name: /Next|بعدی/ }).click();
    await expect(page.locator("form h2").first()).toContainText(/لجستیک|خدمات/, { timeout: 20_000 });

    const w = page.getByTestId("workspace-tour-wizard");
    await expect(w.getByTestId("denali-gear-list")).toBeVisible({ timeout: 20_000 });
    await expect(w.getByText(gear.name)).toBeVisible();
  });

  test("POST /api/tours persists altitude, dayPlans, and gearRequiredIds", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-api-parity-${Date.now()}`;
    const location = await fetchWizardLocationIds(page);
    const gear = await ensureActiveEquipment(page);
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-multi-day", "denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme).toBeTruthy();

    const tourId = await createDenaliTourViaApi(page, location, `${slug}-${runId}`, {
      tourType: "mountain_multi",
      mainTourThemeId: theme!.id,
      peakHeight: 5_100,
      gearItems: [{ id: gear.id, isRequired: true }],
    });

    const tripDetails = await fetchTourTripDetails(page, tourId);
    expect(tripDetails).toBeTruthy();

    const overview = tripDetails!.overview as { maxAltitudeMeters?: number } | undefined;
    expect(overview?.maxAltitudeMeters).toBe(5_100);

    const itinerary = tripDetails!.itinerary as { dayPlans?: Array<{ day: number; description?: string }> } | undefined;
    expect(itinerary?.dayPlans?.length).toBe(3);
    expect(itinerary?.dayPlans?.every((row) => (row.description ?? "").trim().length > 0)).toBe(true);

    const participation = tripDetails!.participation as { gearRequiredIds?: string[] } | undefined;
    expect(participation?.gearRequiredIds).toContain(gear.id);
  });

  test("full wizard submit with map fields reaches tour list", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-submit-${Date.now()}`;
    const location = await fetchWizardLocationIds(page);
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme).toBeTruthy();

    await openDenaliCreateWizardWithFormPatch(page, location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: theme!.id,
      peakHeight: 4_200,
    });

    await advanceDenaliWizardToReview(page, { mainTourTheme: theme!, tourType: "mountain_day" });
    await expect(page.getByTestId("denali-step-review")).toBeVisible({ timeout: 15_000 });

    await submitWizardAndExpectTourList(page);
  });
});
