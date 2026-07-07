import { expect, test } from "@playwright/test";

import { completeGuestClubPortalRegistration } from "./fixtures/complete-portal-registration-by-workspace";

const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.02,
};

test.describe("portal shell visual — guest-club @member-portal:minimal", () => {
  test("SMK-PTL-VIS-guest-01 guest-club member shell header", async ({ page }) => {
    const email = `ptl-vis-guest-${Date.now()}@guest-club-smoke.local`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await completeGuestClubPortalRegistration(page, {
      email,
      fullName: "Portal Visual Guest Club",
      phone,
    });

    await page
      .locator(
        '[data-public-registration-success][data-guest-club-registration-success] a[href*="/me"]'
      )
      .first()
      .click();
    await expect(page).toHaveURL(/\/me\//, { timeout: 60_000 });
    const header = page.locator("[data-portal-shell-header]");
    await expect(header).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("body[data-workspace-plugin='guest-club']")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(header).toHaveScreenshot("guest-club-portal-shell-header.png", SCREENSHOT_OPTS);
  });
});
