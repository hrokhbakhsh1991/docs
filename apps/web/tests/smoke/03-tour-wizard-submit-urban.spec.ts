import { expect, test } from "@playwright/test";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  installTourWizardRegionsAndDestinationsRoutes,
  installTourWizardSettingsRoutes,
  SMOKE_WIZARD_DRAFT_STORAGE_KEY,
  SMOKE_WORKSPACE_BASE_URL,
  smokeTourWizardNewUrl,
  SMOKE_WIZARD_URBAN_E2E_QUERY,
} from "./tour-wizard-smoke-helpers";

const SUBMIT_URBAN_DRAFT_JSON = JSON.stringify({
  overview: {
    title: "1234567890 عنوان تست ارسال ویزارد",
    shortDescription: "خلاصهٔ تست ارسال",
    longDescription: "توضیح کامل تست برای عبور از اعتبارسنجی گام اطلاعات پایه در مسیر شهری.",
    tourType: "city",
  },
  _wizardMeta: {
    resolvedFormProfile: "urban_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  },
  pricing: { basePrice: 100_000, currency: "TOMAN", discountNotes: "" },
  schedule: {
    startDate: "2026-07-10",
    endDate: "2026-07-11",
    departureMeetingTime: "",
    returnMeetingTime: "",
  },
  location: {
    regionId: "44444444-4444-4444-8444-444444444444",
    mainDestinationId: "55555555-5555-4555-8555-555555555555",
    secondaryDestinationIds: [],
    meetingPoint: "",
    returnPoint: "",
    displayLocation: "",
  },
  policies: {
    cancellationPolicy: "سیاست لغو تست smoke.",
    refundPolicy: "سیاست استرداد تست smoke.",
    safetyNotes: "یادداشت ایمنی تست smoke.",
    attendanceRules: "",
    lateArrivalPolicy: "",
    noShowPolicy: "",
    confirmationPolicy: "",
    capacityPolicy: "",
    weatherPolicy: "",
    reservationRules: "",
    riskDisclaimer: "",
    safetyPolicy: "",
  },
});

test.describe("tour wizard urban submit (mocked API)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, { themes: [] });
    await installTourWizardRegionsAndDestinationsRoutes(page);

    /**
     * Avoid `context.addInitScript` that re-seeds draft on every navigation — it races other specs
     * (e.g. urban e2e seed) in the same Playwright worker. Seed once per test on the app origin, then reload.
     */
    await page.goto(`${baseURL}/tours/new`, { waitUntil: "domcontentloaded" });
    await page.evaluate(
      ({ key, json }: { key: string; json: string }) => {
        try {
          localStorage.setItem(key, json);
        } catch {
          /* ignore */
        }
      },
      { key: SMOKE_WIZARD_DRAFT_STORAGE_KEY, json: SUBMIT_URBAN_DRAFT_JSON },
    );
    await page.goto(smokeTourWizardNewUrl(baseURL, SMOKE_WIZARD_URBAN_E2E_QUERY), {
      waitUntil: "domcontentloaded",
    });

    await page.route("**/api/tours", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      if (url.pathname !== "/api/tours") {
        await route.continue();
        return;
      }
      const method = req.method().toUpperCase();
      if (method === "POST") {
        let postBody: Record<string, unknown> = {};
        try {
          const raw = req.postData();
          postBody = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
        } catch {
          postBody = {};
        }
        const td = postBody.tripDetails as Record<string, unknown> | undefined;
        expect(td?.participation ?? null, "urban strip: no participation sent").toBeNull();
        expect(postBody.formProfile, "profile-first create: explicit formProfile").toBe("urban_event");
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({
            id: "tour-smoke-created-1",
            title: String(postBody.title ?? "t"),
            description: "",
            total_capacity: 10,
            accepted_count: 0,
            lifecycle_status: "Draft",
            cost_context: { totalCost: 0, currency: "USD" },
            tour_type: "city",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            form_profile_snapshot: "urban_event",
          }),
        });
        return;
      }
      await route.continue();
    });
    await page.route("**/api/v2/tours", async (route) => {
      if (route.request().method().toUpperCase() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [], total: 0, page: 1, limit: 20 }),
        });
        return;
      }
      await route.continue();
    });
  });

  test("restored urban draft reaches review and POST succeeds", async ({ page }) => {
    const draftPeek = await page.evaluate((k) => localStorage.getItem(k), SMOKE_WIZARD_DRAFT_STORAGE_KEY);
    expect(draftPeek, "draft must be present after beforeEach seed + reload").toContain("urban_event");
    const draftHasMeta = await page.evaluate((k) => {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) return false;
        const o = JSON.parse(raw) as { _wizardMeta?: unknown };
        return Boolean(o && typeof o === "object" && o._wizardMeta && typeof o._wizardMeta === "object");
      } catch {
        return false;
      }
    }, SMOKE_WIZARD_DRAFT_STORAGE_KEY);
    expect(draftHasMeta, "draft JSON must parse and include _wizardMeta object").toBe(true);

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
    const w = page.getByTestId("tour-create-wizard");
    await w.locator('select[name="overview.tourType"]').selectOption("city");
    await expect(page.getByTestId("wizard-form-profile")).toHaveAttribute("data-form-profile", "urban_event", {
      timeout: 25_000,
    });

    await expect(page.locator("form h2").first()).toContainText("اطلاعات پایه", { timeout: 15_000 });
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText("مکان", { timeout: 15_000 });
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText("قوانین", { timeout: 15_000 });
    await page.getByRole("button", { name: "بعدی" }).click();
    await expect(page.locator("form h2").first()).toContainText("بازبینی", { timeout: 15_000 });
    await page.getByRole("button", { name: "ثبت نهایی تور" }).click();
    await expect(page).toHaveURL(/\/tours\/?$/, { timeout: 25_000 });
  });
});
