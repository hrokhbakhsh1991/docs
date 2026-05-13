import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installTourWizardSettingsRoutes,
} from "./tour-wizard-smoke-helpers";

const CLONE_TOUR_ID = "clone-smoke-1";
const CLONE_TITLE = "1234567890 عنوان تور برای تست کلون";

/**
 * Duplicate flow: `?clone=` → BFF `GET /api/tours/:id` → `localStorage` draft + `router.replace("/tours/new")`.
 * @see `tour-create-wizard-wrapper.tsx` + `prompt.md` §17 (E2E duplicate).
 */
test.describe("tour wizard clone query (smoke)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page);

    await page.route(`**/api/tours/${CLONE_TOUR_ID}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: CLONE_TITLE,
          description: "توضیح کامل تور منبع برای تست کلون که طول کافی دارد.",
          tourType: "city",
          autoAcceptRegistrations: true,
          communicationLink: "",
          destinationId: "",
          details: {
            tripDetails: {
              overview: {
                shortIntro: "خلاصه کوتاه منبع کلون",
                mainTourThemeId: "",
                tourThemeIds: [],
              },
              itinerary: { days: [] },
              logistics: {},
              participation: {},
              policies: {},
            },
          },
          costContext: {
            basePriceToman: 0,
            discountNotes: "",
          },
        }),
      });
    });
  });

  test("clone query loads tour into wizard title field", async ({ page }) => {
    const res = await page.goto(`/tours/new?clone=${CLONE_TOUR_ID}`, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByPlaceholder("مثلاً صعود دماوند")).toHaveValue(CLONE_TITLE, { timeout: 10_000 });
  });
});

const CLONE_THEME_META_ID = "clone-smoke-theme-tour";
const CLONE_THEME_ROW_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

/**
 * Clone wrapper resolves `resolvedFormProfile` from `getTourThemes()` when `mainTourThemeId` matches
 * (`tour-create-wizard-wrapper.tsx:247-254`). Smoke asserts `_wizardMeta` written to localStorage.
 */
test.describe("tour wizard clone draft _wizardMeta (smoke)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    const now = new Date().toISOString();
    await installTourWizardSettingsRoutes(page, {
      themes: [
        {
          id: CLONE_THEME_ROW_ID,
          name: "تم کلون meta",
          slug: "clone-theme-meta",
          description: null,
          isActive: true,
          sortOrder: 0,
          formProfile: "cinema_event",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });

    await page.route(`**/api/tours/${CLONE_THEME_META_ID}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: CLONE_TITLE,
          description: "توضیح کامل برای کلون با تم شناخته‌شده در کاتالوگ.",
          tourType: "mountain",
          autoAcceptRegistrations: true,
          communicationLink: "",
          destinationId: "",
          details: {
            tripDetails: {
              overview: {
                shortIntro: "خلاصه کلون تم",
                mainTourThemeId: CLONE_THEME_ROW_ID,
                tourThemeIds: [],
              },
              itinerary: { days: [] },
              logistics: {},
              participation: {},
              policies: {},
            },
          },
          costContext: {
            basePriceToman: 0,
            discountNotes: "",
          },
        }),
      });
    });
  });

  test("clone stores _wizardMeta.resolvedFormProfile from workspace theme row", async ({ page }) => {
    const res = await page.goto(`/tours/new?clone=${CLONE_THEME_META_ID}`, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 25_000 });
    await expect(page.getByPlaceholder("مثلاً صعود دماوند")).toHaveValue(CLONE_TITLE, { timeout: 10_000 });

    const meta = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("tour-create-wizard-draft-v1");
        if (!raw) return null;
        const o = JSON.parse(raw) as { _wizardMeta?: { resolvedFormProfile?: string; themeIds?: { main?: string } } };
        return o._wizardMeta ?? null;
      } catch {
        return null;
      }
    });
    expect(meta?.resolvedFormProfile).toBe("cinema_event");
    expect(meta?.themeIds?.main).toBe(CLONE_THEME_ROW_ID);
  });
});

const CLONE_FALLBACK_ID = "clone-smoke-fallback-tour";
const CLONE_UNKNOWN_THEME_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test.describe("tour wizard clone draft _wizardMeta fallback tourType (smoke)", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || "http://127.0.0.1:3000";
    await installLeaderWorkspaceSessionRoute(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, {
      themes: [
        {
          id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          name: "تم دیگر",
          slug: "other-theme",
          description: null,
          isActive: true,
          sortOrder: 0,
          formProfile: "general",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    await page.route(`**/api/tours/${CLONE_FALLBACK_ID}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          title: CLONE_TITLE,
          description: "کلون با تم ناموجود در کاتالوگ.",
          tourType: "city",
          autoAcceptRegistrations: true,
          communicationLink: "",
          destinationId: "",
          details: {
            tripDetails: {
              overview: {
                shortIntro: "خلاصه",
                mainTourThemeId: CLONE_UNKNOWN_THEME_ID,
                tourThemeIds: [],
              },
              itinerary: { days: [] },
              logistics: {},
              participation: {},
              policies: {},
            },
          },
          costContext: {
            basePriceToman: 0,
            discountNotes: "",
          },
        }),
      });
    });
  });

  test("clone stores urban_event in _wizardMeta when main theme id is missing from catalog", async ({ page }) => {
    const res = await page.goto(`/tours/new?clone=${CLONE_FALLBACK_ID}`, { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 25_000 });

    const meta = await page.evaluate(() => {
      try {
        const raw = localStorage.getItem("tour-create-wizard-draft-v1");
        if (!raw) return null;
        const o = JSON.parse(raw) as { _wizardMeta?: { resolvedFormProfile?: string } };
        return o._wizardMeta ?? null;
      } catch {
        return null;
      }
    });
    expect(meta?.resolvedFormProfile).toBe("urban_event");
  });
});
