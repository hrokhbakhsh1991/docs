import { expect, test } from "@playwright/test";

const SCREENSHOT_OPTS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.02,
};

test.describe("marketing shell visual — urban", () => {
  test("SMK-MKT-VIS-urban-01 urban home shell header", async ({ page }) => {
    await page.goto("/");
    const header = page.locator("[data-marketing-header]");
    await expect(header).toBeVisible({ timeout: 60_000 });
    await expect(page.locator("body[data-workspace-plugin='urban']")).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(header).toHaveScreenshot("urban-home-shell-header.png", SCREENSHOT_OPTS);
  });

  test("SMK-MKT-VIS-urban-02 urban catalog shell chrome", async ({ page }) => {
    await page.goto("/tours");
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    const chrome = page.locator("[data-marketing-header], [data-marketing-catalog-toolbar]");
    await page.waitForLoadState("networkidle");
    await expect(chrome.first()).toBeVisible();
    await expect(page.locator("body")).toHaveScreenshot("urban-catalog-shell-chrome.png", {
      ...SCREENSHOT_OPTS,
      clip: { x: 0, y: 0, width: 1280, height: 320 },
    });
  });
});
