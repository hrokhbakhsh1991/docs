import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  installTourWizardSettingsRoutes,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

const TOUR_ID = "tour-edit-urban-smoke-1";
const THEME_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

test.describe("tour edit urban profile PATCH (mocked API)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, {
      themes: [
        {
          id: THEME_ID,
          name: "تم تست شهری",
          slug: "urban-smoke-theme",
          description: null,
          isActive: true,
          sortOrder: 0,
          formProfile: "urban_event",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    // Match by pathname — `apiClient` uses absolute URLs; glob-only patterns can miss on some hosts.
    await context.route("**/*", async (route) => {
      let pathname = "";
      try {
        pathname = new URL(route.request().url()).pathname;
      } catch {
        await route.continue();
        return;
      }
      const bffTourPath = `/api/tours/${TOUR_ID}`;
      if (pathname !== bffTourPath && pathname !== `/api/v2/tours/${TOUR_ID}`) {
        await route.continue();
        return;
      }

      const req = route.request();
      const method = req.method().toUpperCase();

      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: TOUR_ID,
            title: "Urban edit smoke tour",
            description: "Smoke tour for PATCH strip assertions.",
            total_capacity: 12,
            accepted_count: 0,
            lifecycle_status: "DRAFT",
            tour_type: "city",
            cost_context: { totalCost: 10, currency: "USD", location: "Test city" },
            details: {
              tripDetails: {
                overview: {
                  tourThemeIds: [THEME_ID],
                  shortIntro: "short",
                  longDescription: "long enough for validation if surfaced",
                },
                itinerary: {
                  dayPlans: [{ day: 1, title: "should strip", description: "" }],
                },
                participation: { requirements: "should strip" },
                logistics: { primaryTransportMode: "bus", includedServices: "should strip" },
                policies: {},
              },
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            form_profile_snapshot: "urban_event",
          }),
        });
        return;
      }

      if (method === "PATCH") {
        let body: Record<string, unknown> = {};
        try {
          const raw = req.postData();
          body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          body = {};
        }

        const td = body.tripDetails as Record<string, unknown> | undefined;
        expect(td, "PATCH includes tripDetails").toBeTruthy();
        expect(body.formProfile, "profile-first PATCH: explicit formProfile").toBe("urban_event");
        expect("participation" in (td as Record<string, unknown>), "urban edit strip: participation omitted").toBe(false);

        const itin = td?.itinerary as Record<string, unknown> | undefined;
        expect(itin == null || !("dayPlans" in itin), "urban edit strip: itinerary dayPlans omitted").toBe(true);

        const log = td?.logistics as Record<string, unknown> | undefined;
        if (log != null) {
          const allowed = new Set([
            "meetingPoint",
            "departureMeetingTime",
            "departureDate",
            "returnDate",
            "returnPoint",
          ]);
          for (const k of Object.keys(log)) {
            expect(allowed.has(k), `urban edit strip: unexpected logistics key ${k}`).toBe(true);
          }
          expect("primaryTransportMode" in log, "urban edit strip: primary transport omitted").toBe(false);
          expect("includedServices" in log, "urban edit strip: includedServices omitted").toBe(false);
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: TOUR_ID,
            title: String(body.title ?? "Urban edit smoke tour"),
            description: String(body.description ?? ""),
            total_capacity: typeof body.total_capacity === "number" ? body.total_capacity : 12,
            accepted_count: 0,
            lifecycle_status: "DRAFT",
            tour_type: "city",
            cost_context: { totalCost: 10, currency: "USD", location: "Test city" },
            details: {
              tripDetails: td ?? {},
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            form_profile_snapshot: "urban_event",
          }),
        });
        return;
      }

      await route.continue();
    });
  });

  test("save strips inactive groups for urban_event theme binding", async ({ page }) => {
    const res = await page.goto(`/tours/${encodeURIComponent(TOUR_ID)}/edit`, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);

    // Urban event is mapped to Denali rail, so it launches DenaliTourEditForm
    await expect(page.getByTestId("denali-edit-tour-form")).toBeVisible({ timeout: 25_000 });
    const nameInput = page.getByPlaceholder("مثلاً صعود دماوند از مسیر جنوبی");
    await expect(nameInput).toBeVisible({ timeout: 10_000 });
    await nameInput.fill("Urban edit smoke tour (updated)");

    await page.getByRole("button", { name: "ذخیره تغییرات" }).click();

    await expect(page).toHaveURL(new RegExp(`/tours/${TOUR_ID}(?:/|$)`), { timeout: 25_000 });
  });
});
