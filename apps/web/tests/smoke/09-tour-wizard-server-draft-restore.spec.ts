import { expect, test } from "@playwright/test";
import { TOUR_FORM_PROFILE_VERSION } from "@repo/types";

import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installSmokeServerDraftEnabled,
  installSmokeTourOpsSessionToken,
  installTourWizardServerDraftRoutes,
  installTourWizardSettingsRoutes,
  purgeTourWizardDraftStorage,
  SMOKE_WIZARD_DRAFT_STORAGE_KEY,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

const SERVER_TITLE = "server draft restore title";

const SERVER_ENVELOPE = {
  overview: {
    title: SERVER_TITLE,
    shortDescription: "خلاصه از پیش‌نویس سرور",
    longDescription: "توضیح کامل بازیابی‌شده از سرور برای smoke تست cross-device.",
    tourType: "city",
  },
  _wizardMeta: {
    resolvedFormProfile: "urban_event",
    formProfileVersion: TOUR_FORM_PROFILE_VERSION,
  },
};

test.describe("tour wizard server draft restore", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installSmokeServerDraftEnabled(page);
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, { themes: [] });
  });

  test("server draft wins over stale local savedAt (cross-device)", async ({ page }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;

    await installTourWizardServerDraftRoutes(page, {
      getDraft: {
        envelope: SERVER_ENVELOPE,
        updatedAt: "2026-05-17T18:00:00.000Z",
        rowVersion: 3,
      },
    });

    await page.goto(`${baseURL}/tours/new`, { waitUntil: "domcontentloaded" });
    await purgeTourWizardDraftStorage(page);
    await page.evaluate(
      ({ key }: { key: string }) => {
        localStorage.setItem(
          key,
          JSON.stringify({
            overview: {
              title: "stale local draft title",
              shortDescription: "قدیمی",
              longDescription: "پیش‌نویس محلی قدیمی.",
              tourType: "city",
            },
            _wizardMeta: {
              resolvedFormProfile: "urban_event",
              formProfileVersion: 1,
              savedAt: "2026-01-01T00:00:00.000Z",
            },
          }),
        );
      },
      { key: SMOKE_WIZARD_DRAFT_STORAGE_KEY },
    );

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[name="overview.title"]')).toHaveValue(SERVER_TITLE, {
      timeout: 30_000,
    });
  });

  test("server-only draft restores on empty local (new device)", async ({ page }) => {
    await installTourWizardServerDraftRoutes(page, {
      getDraft: {
        envelope: SERVER_ENVELOPE,
        updatedAt: "2026-05-17T18:00:00.000Z",
        rowVersion: 1,
      },
    });

    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await purgeTourWizardDraftStorage(page);

    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(page.getByTestId("tour-create-wizard")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[name="overview.title"]')).toHaveValue(SERVER_TITLE, {
      timeout: 30_000,
    });
  });
});
