import { expect, test } from "@playwright/test";

const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.02,
};

test.describe("marketing shell visual — denali", () => {
  test("SMK-MKT-VIS-01 denali home shell header", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("[data-marketing-header]");
    await expect(header).toBeVisible({ timeout: 60_000 });
    await page.waitForLoadState("networkidle");
    await expect(header).toHaveScreenshot("denali-home-shell-header.png", SCREENSHOT_OPTS);
  });

  test("SMK-MKT-VIS-02 denali catalog shell chrome", async ({ page }) => {
    await page.goto("/tours");
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    const chrome = page.locator("[data-marketing-header], [data-marketing-catalog-toolbar]");
    await page.waitForLoadState("networkidle");
    await expect(chrome.first()).toBeVisible();
    await expect(page.locator("body")).toHaveScreenshot("denali-catalog-shell-chrome.png", {
      ...SCREENSHOT_OPTS,
      clip: { x: 0, y: 0, width: 1280, height: 320 },
    });
  });
});
