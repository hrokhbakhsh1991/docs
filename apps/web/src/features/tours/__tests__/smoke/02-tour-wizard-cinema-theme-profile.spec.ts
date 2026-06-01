import { expect, test } from "@playwright/test";

import {
  expectClassicWizardShellUnavailable,
  installTourWizardSettingsRoutes,
  installTourWizardSmokeAuth,
  SMOKE_WORKSPACE_BASE_URL,
  waitForDenaliWizardAuthHydrated,
} from "./tour-wizard-smoke-helpers";

const WORKSPACE_TEMPLATE_PROFILE = "cinema_event" as const;

/**
 * `cinema_event` remains a classic profile in types; create UI uses Denali rail only for
 * `denali_pilot` / `urban_event`. Smoke documents classic shell retirement message.
 */
test.describe("tour wizard cinema workspace template", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    await installTourWizardSmokeAuth(page, context, baseURL);
    const now = new Date().toISOString();
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: WORKSPACE_TEMPLATE_PROFILE,
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

  test("cinema_event template resolves to classic-unavailable create shell", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await waitForDenaliWizardAuthHydrated(page);
    await expectClassicWizardShellUnavailable(page);
  });
});
