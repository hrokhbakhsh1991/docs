import { expect, test } from "@playwright/test";
import {
  installDenaliWizardSmokeStack,
  installUrbanWizardE2eSeed,
  smokeTourWizardNewUrl,
  SMOKE_WIZARD_URBAN_E2E_QUERY,
  SMOKE_WORKSPACE_BASE_URL,
  waitForDenaliWizardAuthHydrated,
} from "./tour-wizard-smoke-helpers";

const WORKSPACE_TEMPLATE_PROFILE = "urban_event" as const;

test.describe("tour wizard urban workspace template (denali rail)", () => {
  test.beforeEach(async ({ page, context }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    await installUrbanWizardE2eSeed(page);
    await installDenaliWizardSmokeStack(page, context, {
      baseURL,
      workspaceTemplateProfile: WORKSPACE_TEMPLATE_PROFILE,
    });
  });

  test("urban_event mounts denali workspace wizard shell", async ({ page }, testInfo) => {
    const baseURL = testInfo.project.use.baseURL ?? SMOKE_WORKSPACE_BASE_URL;
    const res = await page.goto(smokeTourWizardNewUrl(baseURL, SMOKE_WIZARD_URBAN_E2E_QUERY), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    expect(res?.status() ?? 0).toBeLessThan(500);

    await waitForDenaliWizardAuthHydrated(page);

    const w = page.getByTestId("workspace-tour-wizard");
    await expect(w).toBeVisible({ timeout: 20_000 });
    await expect(w).toHaveAttribute("data-resolved-form-profile", WORKSPACE_TEMPLATE_PROFILE);
    await expect(w).toHaveAttribute("data-wizard-rail", "denali");
  });
});
