import { expect, test } from "@playwright/test";

import type { DenaliTourKind } from "@repo/types";

import {
  advanceDenaliWizardToReview,
  buildDenaliSubmitDraftJson,
  clearWizardDrafts,
  createDenaliTourViaApi,
  ensureActiveEquipment,
  fetchTourThemes,
  resolveDenaliIntegrationTheme,
  fetchTourTripDetails,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  seedWizardDraft,
  submitWizardAndExpectTourList,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;

async function gotoDenaliWizardWithDraft(
  page: import("@playwright/test").Page,
  slug: string,
  draftJson: string,
): Promise<void> {
  await clearWizardDrafts(page, slug);
  await seedWizardDraft(page, slug, draftJson);
  await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("denali-create-tour-wizard")).toBeVisible({ timeout: 45_000 });
}

async function openDenaliProgramStep(
  page: import("@playwright/test").Page,
  tourType: DenaliTourKind,
  theme?: { id: string; name: string; formProfile: string },
): Promise<void> {
  const w = page.getByTestId("denali-create-tour-wizard");
  await page.getByRole("button", { name: "بعدی" }).click();
  await expect(page.locator("form h2").first()).toContainText(/برنامه/, { timeout: 20_000 });
  if (theme) {
    const themeCheckbox = w.getByTestId(`denali-theme-select-${(theme as any).slug}`);
    await expect(themeCheckbox).toBeVisible({ timeout: 30_000 });
    await themeCheckbox.check();
  }
  void tourType;
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

  test("mountain_day program step shows altitude field", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-altitude-visible-${Date.now()}`;
    const location = await fetchWizardLocationIds(page);
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme, "mountain theme (slug or denali_pilot/mountain_outdoor)").toBeTruthy();

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: theme!.id,
    });
    await gotoDenaliWizardWithDraft(page, slug, draftJson);
    await openDenaliProgramStep(page, "mountain_day", theme!);

    const w = page.getByTestId("denali-create-tour-wizard");
    await expect(w.getByTestId("denali-program-altitude")).toBeVisible({ timeout: 10_000 });
  });

  test("mountain_day with nature_trip theme still shows altitude (category-driven)", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-altitude-category-${Date.now()}`;
    const location = await fetchWizardLocationIds(page);
    const themes = await fetchTourThemes(page);
    const natureTheme = themes.find((t) => t.formProfile === "nature_trip");
    test.skip(!natureTheme, "workspace has no nature_trip theme");

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: natureTheme!.id,
    });
    await gotoDenaliWizardWithDraft(page, slug, draftJson);
    await openDenaliProgramStep(page, "mountain_day", natureTheme!);

    const w = page.getByTestId("denali-create-tour-wizard");
    await expect(w.getByTestId("denali-program-altitude")).toBeVisible({ timeout: 10_000 });
  });

  test("mountain_multi program step shows three daily itinerary fields", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-itinerary-${Date.now()}`;
    const location = await fetchWizardLocationIds(page);
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-multi-day", "denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme, "mountain multi theme").toBeTruthy();

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      tourType: "mountain_multi",
      mainTourThemeId: theme!.id,
    });
    await gotoDenaliWizardWithDraft(page, slug, draftJson);
    await openDenaliProgramStep(page, "mountain_multi", theme!);

    const w = page.getByTestId("denali-create-tour-wizard");
    await expect(w.getByTestId("denali-daily-itinerary")).toBeVisible({ timeout: 10_000 });
    await expect(w.locator('[data-testid^="denali-itinerary-day-"]')).toHaveCount(3, {
      timeout: 15_000,
    });
  });

  test("pricing step shows gear list when workspace has equipment", async ({ page }, testInfo) => {
    const slug = tenantSlugFromProject(testInfo.project.metadata);
    const runId = `map-gear-ui-${Date.now()}`;
    const gear = await ensureActiveEquipment(page);
    const location = await fetchWizardLocationIds(page);
    const theme = await resolveDenaliIntegrationTheme(page, {
      preferredSlugs: ["denali-mountain-1-day"],
      formProfiles: ["denali_pilot", "mountain_outdoor"],
    });
    expect(theme).toBeTruthy();

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: theme!.id,
      gearItems: [{ id: gear.id, isRequired: true }],
    });
    await gotoDenaliWizardWithDraft(page, slug, draftJson);

    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText(/برنامه/, { timeout: 20_000 });
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText(/حمل/, { timeout: 20_000 });
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText(/هزینه/, { timeout: 20_000 });

    const w = page.getByTestId("denali-create-tour-wizard");
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
      altitudeMeasurement: 5_100,
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

    const draftJson = buildDenaliSubmitDraftJson(location, `${slug}-${runId}`, {
      tourType: "mountain_day",
      mainTourThemeId: theme!.id,
      altitudeMeasurement: 4_200,
    });
    await gotoDenaliWizardWithDraft(page, slug, draftJson);

    await advanceDenaliWizardToReview(page, { mainTourTheme: theme!, tourType: "mountain_day" });
    await expect(page.getByTestId("denali-step-review")).toBeVisible({ timeout: 15_000 });

    await submitWizardAndExpectTourList(page);
  });
});
