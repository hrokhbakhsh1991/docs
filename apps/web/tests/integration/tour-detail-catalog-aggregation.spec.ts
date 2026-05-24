import { expect, test } from "@playwright/test";

import {
  createDenaliTourViaApi,
  ensureActiveEquipment,
  fetchTourTripDetails,
  fetchWizardLocationIds,
  loginWithPhoneOtp,
  ownerPhoneFromProject,
  resolveDenaliIntegrationTheme,
  tenantSlugFromProject,
} from "./real-tenant.helpers";

const skipUnlessRealStack = !process.env.PW_REAL_STACK;
const FIXED_TOUR_ID = process.env.PW_TOUR_DETAIL_TOUR_ID?.trim();

function tripDetailsFromTourBody(body: Record<string, unknown>): Record<string, unknown> | null {
  const data = body.data ?? body;
  if (data == null || typeof data !== "object") {
    return null;
  }
  const row = data as {
    tripDetails?: Record<string, unknown>;
    details?: { tripDetails?: Record<string, unknown> } | null;
  };
  return row.tripDetails ?? row.details?.tripDetails ?? null;
}

test.describe("tour detail catalog aggregation (member-facing BFF)", () => {
  test.skip(skipUnlessRealStack, "set PW_REAL_STACK=1 with API on 3001 and web on PW_BASE_URL");

  test("GET /api/tours/:id exposes resolved themes and gear; detail page shows cards", async ({
    page,
  }, testInfo) => {
    await loginWithPhoneOtp(page, ownerPhoneFromProject(testInfo.project.metadata));

    let tourId = FIXED_TOUR_ID ?? "";
    if (!tourId) {
      const slug = tenantSlugFromProject(testInfo.project.metadata);
      const location = await fetchWizardLocationIds(page);
      const gear = await ensureActiveEquipment(page);
      const theme = await resolveDenaliIntegrationTheme(page, {
        preferredSlugs: ["denali-mountain-1-day", "denali-mountain-multi-day"],
        formProfiles: ["denali_pilot", "mountain_outdoor"],
      });
      expect(theme).toBeTruthy();

      tourId = await createDenaliTourViaApi(page, location, `${slug}-detail-agg-${Date.now()}`, {
        tourType: "mountain_day",
        mainTourThemeId: theme!.id,
        gearItems: [{ id: gear.id, isRequired: true }],
      });
    }

    const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
    expect(tourRes.ok(), `GET /api/tours/${tourId} failed: ${tourRes.status()}`).toBeTruthy();
    const tourBody = (await tourRes.json()) as Record<string, unknown>;
    expect(["OWNER", "ADMIN"]).toContain(tourBody.accessLevel);
    const viewHints = tourBody.viewHints as { gpsUnlocked?: boolean } | undefined;
    expect(viewHints?.gpsUnlocked).toBe(true);

    const tripDetails = tripDetailsFromTourBody(tourBody);
    expect(tripDetails).toBeTruthy();

    const itinerary = tripDetails!.itinerary as { segmentActivities?: unknown[] } | undefined;
    expect(
      Array.isArray(itinerary?.segmentActivities) && itinerary!.segmentActivities!.length > 0,
      "owner/admin BFF should include full itinerary segments",
    ).toBeTruthy();

    const overview = tripDetails!.overview as {
      tourThemeIds?: string[];
      resolvedThemes?: { id: string; name: string }[];
    };
    const themeIds = overview.tourThemeIds ?? [];
    const resolvedThemes = overview.resolvedThemes ?? [];
    expect(
      themeIds.length > 0 || resolvedThemes.length > 0,
      "tour should have theme ids or resolvedThemes from BFF",
    ).toBeTruthy();
    if (resolvedThemes.length > 0) {
      expect(resolvedThemes.every((row) => row.name.trim().length > 0)).toBeTruthy();
    }

    const participation = tripDetails!.participation as {
      gearRequiredIds?: string[];
      resolvedGear?: {
        required: { id: string; name: string }[];
        optional: { id: string; name: string }[];
      };
    };
    const gearIds = participation?.gearRequiredIds ?? [];
    const resolvedRequired = participation?.resolvedGear?.required ?? [];
    expect(
      gearIds.length > 0 || resolvedRequired.length > 0,
      "tour should have gear ids or resolvedGear from BFF",
    ).toBeTruthy();
    if (resolvedRequired.length > 0) {
      expect(resolvedRequired.every((row) => row.name.trim().length > 0)).toBeTruthy();
    }

    await page.goto(`/tours/${encodeURIComponent(tourId)}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("tour-detail-themes")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("tour-detail-equipment")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("tour-detail-locked-itinerary")).toHaveCount(0);

    const persisted = await fetchTourTripDetails(page, tourId);
    expect(persisted).toBeTruthy();
  });
});
