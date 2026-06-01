import { expect, test } from "@playwright/test";

import {
  expectClassicWizardShellUnavailable,
  installTourWizardSettingsRoutes,
  installTourWizardSmokeAuth,
  SMOKE_WORKSPACE_BASE_URL,
  waitForDenaliWizardAuthHydrated,
} from "./tour-wizard-smoke-helpers";

test.describe("tour wizard preset picker (classic profile)", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    await installTourWizardSmokeAuth(page, context, baseURL);
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
          id: "preset-cinema-only",
          name: "قالب سینما",
          description: null,
          isActive: true,
          sortOrder: 1,
          matchTourType: null,
          matchMainTourThemeId: null,
          formProfile: "cinema_event",
          defaults: {},
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  });

  test("cinema_event create route shows classic shell retired (presets UI deferred)", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await waitForDenaliWizardAuthHydrated(page);
    await expectClassicWizardShellUnavailable(page);
  });
});
