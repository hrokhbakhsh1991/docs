/**
 * MEG-UX — capture operator engagement screenshots at standard viewports.
 */
import { expect, test } from "@playwright/test";

import { loginDenaliOperatorOwner } from "./fixtures/authenticate-denali-operator-for-engagement";

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

const PREFIX = process.env.MEG_UX_CAPTURE_PREFIX ?? "before";
const ARTIFACT_DIR = process.env.MEG_UX_CAPTURE_DIR ?? "/opt/cursor/artifacts";

test.describe("MEG-UX operator capture", () => {
  test("engagement overview surfaces", async ({ page }) => {
    await loginDenaliOperatorOwner(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/engagement", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-operator-engagement-page]")).toBeVisible({
        timeout: 90_000,
      });
      await page.screenshot({
        path: `${ARTIFACT_DIR}/${PREFIX}-operator-engagement-${viewport.name}.png`,
        fullPage: true,
      });
    }
  });
});
