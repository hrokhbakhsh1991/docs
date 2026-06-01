import { expect, test } from "@playwright/test";
import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  installTourWizardSettingsRoutes,
  installUrbanWizardE2eSeed,
  SMOKE_WORKSPACE_BASE_URL,
} from "./tour-wizard-smoke-helpers";

/**
 * Smoke: Denali host serves the create wizard shell (no live Tour-Ops API).
 * Run: `TEST_PLATFORM_BASE_URL=http://workspace-test.localhost:3000 pnpm run build:smoke && playwright test -c playwright.smoke.config.ts src/features/tours/__tests__/smoke/10-denali-wizard-shell.spec.ts`
 */
test.describe("denali tour create wizard shell", () => {
  test.beforeEach(async ({ page, context }) => {
    const baseURL = test.info().project.use.baseURL || SMOKE_WORKSPACE_BASE_URL;
    await installUrbanWizardE2eSeed(page);
    await installLeaderWorkspaceSessionRoute(page);
    await installSmokeTourOpsSessionToken(page);
    await addLeaderSmokeSessionCookie(context, baseURL);
    await installTourWizardSettingsRoutes(page, {
      workspaceTemplateProfile: "denali_pilot",
    });
  });

  test("/tours/new shows denali MVP wizard when denali_pilot profile", async ({ page }) => {
    const res = await page.goto("/tours/new");
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);

    const denali = page.getByTestId("workspace-tour-wizard");

    await expect(denali).toBeVisible({ timeout: 15_000 });
    await expect(denali).toHaveAttribute("data-wizard-rail", "denali");
    await expect(denali).toHaveAttribute("data-resolved-form-profile", "denali_pilot");
    await expect(denali).toHaveAttribute("data-wizard-step-count", "7");
  });
});
