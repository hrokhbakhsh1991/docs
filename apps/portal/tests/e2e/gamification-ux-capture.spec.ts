/**
 * MEG-UX — capture member engagement screenshots at standard viewports.
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForEngagement } from "./fixtures/authenticate-portal-member-for-engagement";

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

const PREFIX = process.env.MEG_UX_CAPTURE_PREFIX ?? "before";
const ARTIFACT_DIR = process.env.MEG_UX_CAPTURE_DIR ?? "/opt/cursor/artifacts";

test.describe("MEG-UX portal capture", () => {
  test("member dashboard engagement surfaces", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForEngagement(page, {
      phone,
      fullName: "UX Capture Member",
    });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/me/home", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-portal-member-home]")).toBeVisible({ timeout: 90_000 });
      await page.screenshot({
        path: `${ARTIFACT_DIR}/${PREFIX}-portal-member-home-${viewport.name}.png`,
        fullPage: true,
      });

      await page.goto("/me/engagement", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-portal-member-engagement-page]")).toBeVisible({
        timeout: 90_000,
      });
      await page.screenshot({
        path: `${ARTIFACT_DIR}/${PREFIX}-portal-member-engagement-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });
});
