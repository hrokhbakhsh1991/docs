import { expect, test } from "@playwright/test";

import { completePortalCatalogRegistration } from "./fixtures/complete-portal-registration";

const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.02,
};

test.describe("portal shell visual — denali @member-portal:full", () => {
  test("SMK-PTL-VIS-01 denali member shell header", async ({ page }) => {
    const email = `ptl-vis-denali-${Date.now()}@denali-smoke.local`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await completePortalCatalogRegistration(page, {
      email,
      fullName: "Portal Visual Denali",
      phone,
    });

    await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
    await expect(page).toHaveURL(/\/me\//, { timeout: 60_000 });
    const header = page.locator("[data-portal-shell-header]");
    await expect(header).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("body[data-workspace-plugin='denali']")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(header).toHaveScreenshot("denali-portal-shell-header.png", SCREENSHOT_OPTS);
  });
});
