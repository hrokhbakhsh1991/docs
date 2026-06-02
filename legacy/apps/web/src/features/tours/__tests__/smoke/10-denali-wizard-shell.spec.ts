import { expect, test } from "@playwright/test";
import {
  installDenaliWizardSmokeStack,
  SMOKE_WORKSPACE_BASE_URL,
  waitForDenaliWizardAuthHydrated,
} from "./tour-wizard-smoke-helpers";

/**
 * Smoke: Denali create wizard shell (no live Tour-Ops API).
 */
test.describe("denali tour create wizard shell", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    await installDenaliWizardSmokeStack(page, context, {
      baseURL,
      workspaceTemplateProfile: "denali_pilot",
    });
  });

  test("/tours/new shows denali wizard when denali_pilot profile", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);

    await waitForDenaliWizardAuthHydrated(page);

    const denali = page.getByTestId("workspace-tour-wizard");
    await expect(denali).toBeVisible({ timeout: 20_000 });
    await expect(denali).toHaveAttribute("data-wizard-rail", "denali");
    await expect(denali).toHaveAttribute("data-resolved-form-profile", "denali_pilot");
    await expect(denali).toHaveAttribute("data-wizard-step-count", "7");
  });
});
