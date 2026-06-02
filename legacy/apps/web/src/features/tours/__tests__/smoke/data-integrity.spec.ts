import { expect, test } from "@playwright/test";

import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";
import {
  assertDenaliTemplateNotLegacyGeneral,
  DATA_MISMATCH_LEGACY_PROFILE_ON_DENALI_TEMPLATE,
  isDenaliStructuredTemplate,
  type WizardTemplateEnvelope,
} from "./wizard-template-data-integrity";

/**
 * Data integrity alarm: Denali-shaped workspace templates must not carry `baseProfile: general`.
 *
 * Real stack (recommended):
 *   TEST_PLATFORM_BASE_URL=http://workspace-test.localhost:3000 PW_NO_WEB_SERVER=1 \
 *   playwright test -c playwright.smoke.config.ts src/features/tours/__tests__/smoke/data-integrity.spec.ts
 *
 * Requires web BFF + API + DB; only auth routes are stubbed so `tour-wizard-template` hits the database.
 */
test.describe("workspace wizard template data integrity", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
  });

  test("GET tour-wizard-template: Denali-structured rows must not use baseProfile general", async ({
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    const templateUrl = new URL("/api/settings/tour-wizard-template", baseURL).href;

    const response = await page.request.get(templateUrl);

    if (response.status() === 401) {
      test.skip(true, "Not authenticated — log in on this host or run with smoke session + API up.");
    }

    expect(response.ok(), `template fetch failed: ${response.status()} ${await response.text()}`).toBe(
      true,
    );

    const envelope = (await response.json()) as WizardTemplateEnvelope;
    const template = envelope.template;

    expect(template, "workspace_tour_wizard_templates row missing for this host").toBeTruthy();

    if (!isDenaliStructuredTemplate(template!)) {
      test.skip(true, "Template is classic-shaped; Denali profile guard not applicable.");
    }

    assertDenaliTemplateNotLegacyGeneral(template!);
    expect(template!.baseProfile, DATA_MISMATCH_LEGACY_PROFILE_ON_DENALI_TEMPLATE).not.toBe(
      "general",
    );
  });

  test("live /tours/new Denali rail must not pair with general baseProfile from API", async ({
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    const templateUrl = new URL("/api/settings/tour-wizard-template", baseURL).href;

    const response = await page.request.get(templateUrl);
    if (response.status() === 401) {
      test.skip(true, "Not authenticated — log in on this host or run with smoke session + API up.");
    }
    expect(response.ok()).toBe(true);

    const envelope = (await response.json()) as WizardTemplateEnvelope;
    const template = envelope.template;
    expect(template).toBeTruthy();

    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });

    const denaliWizard = page.getByTestId("workspace-tour-wizard");
    const denaliVisible = await denaliWizard.isVisible().catch(() => false);

    if (!denaliVisible) {
      test.skip(true, "Denali create rail not mounted on this host (classic workspace).");
    }

    if (template!.baseProfile === "general") {
      throw new Error(DATA_MISMATCH_LEGACY_PROFILE_ON_DENALI_TEMPLATE);
    }

    if (isDenaliStructuredTemplate(template!)) {
      assertDenaliTemplateNotLegacyGeneral(template!);
    }
  });
});
