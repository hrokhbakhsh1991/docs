import { expect, test } from "@playwright/test";

import { completeUrbanPortalRegistration } from "./fixtures/complete-portal-registration-by-workspace";

const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.02,
};

test.describe("portal shell visual — urban @member-portal:minimal", () => {
  test("SMK-PTL-VIS-urban-01 urban member shell header", async ({ page }) => {
    const email = `ptl-vis-urban-${Date.now()}@urban-smoke.local`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await completeUrbanPortalRegistration(page, {
      email,
      fullName: "Portal Visual Urban",
      phone,
    });

    await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
    await expect(page).toHaveURL(/\/me\//, { timeout: 60_000 });
    const header = page.locator("[data-portal-shell-header]");
    await expect(header).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("body[data-workspace-plugin='urban']")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(header).toHaveScreenshot("urban-portal-shell-header.png", SCREENSHOT_OPTS);
  });
});
