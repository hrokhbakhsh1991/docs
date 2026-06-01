import { expect, test } from "@playwright/test";

import {
  expectClassicWizardShellUnavailable,
  installTourWizardSettingsRoutes,
  installTourWizardSmokeAuth,
  SMOKE_WORKSPACE_BASE_URL,
  waitForDenaliWizardAuthHydrated,
} from "./tour-wizard-smoke-helpers";

const WORKSPACE_TEMPLATE_PROFILE = "mountain_outdoor" as const;

test.describe("tour wizard theme selection (classic profile)", () => {
  const now = new Date().toISOString();

  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    await installTourWizardSmokeAuth(page, context, baseURL);
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: WORKSPACE_TEMPLATE_PROFILE,
      themes: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "رویداد شهری",
          slug: "mix-smoke-urban",
          description: null,
          isActive: true,
          sortOrder: 10,
          formProfile: "urban_event",
          createdAt: now,
          updatedAt: now,
        },
      ],
    });
  });

  test("mountain_outdoor template keeps classic-unavailable shell regardless of theme row", async ({
    page,
  }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await waitForDenaliWizardAuthHydrated(page);
    await expectClassicWizardShellUnavailable(page);
  });
});
