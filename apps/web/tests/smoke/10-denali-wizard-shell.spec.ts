import { expect, test } from "@playwright/test";
import {
  addLeaderSmokeSessionCookie,
  installLeaderWorkspaceSessionRoute,
  installSmokeTourOpsSessionToken,
  installTourWizardSettingsRoutes,
  installUrbanWizardE2eSeed,
} from "./tour-wizard-smoke-helpers";

/**
 * Smoke: Denali host serves the 5-step MVP create wizard shell (no live API required for DOM).
 * Run: `PW_BASE_URL=http://denali.localhost:3000 pnpm run build:smoke && PW_BASE_URL=http://denali.localhost:3000 playwright test -c playwright.smoke.config.ts tests/smoke/10-denali-wizard-shell.spec.ts`
 */
test.describe("denali tour create wizard shell", () => {
  test.beforeEach(async ({ page, context }) => {

    const baseURL = test.info().project.use.baseURL || "http://denali.localhost:3000";
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

    const denali = page.getByTestId("denali-create-tour-wizard");

    // Wait for the Denali wizard shell to render
    await expect(denali).toBeVisible({ timeout: 15000 });

    // Assert the Denali wizard configuration attributes
    await expect(denali).toHaveAttribute("data-wizard-rail", "denali");
    await expect(denali).toHaveAttribute("data-resolved-form-profile", "denali_pilot");
    await expect(denali).toHaveAttribute("data-wizard-step-count", "5");
  });
});

