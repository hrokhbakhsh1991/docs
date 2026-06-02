import { expect, test, type Page } from "@playwright/test";

async function openPlayground(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("web-ui-playground-theme", "light");
  });
  await page.goto("/ui-playground");
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}",
  });
  await page.evaluate(() => {
    const el = document.activeElement;
    if (el instanceof HTMLElement) el.blur();
  });
}

const screenshotOpts = { maxDiffPixelRatio: 0.02 as const };

test.describe("UI Playground Visual Tests", () => {
  test("buttons", async ({ page }) => {
    await openPlayground(page);
    const section = page.locator("#section-buttons");
    await expect(section).toHaveScreenshot("buttons.png", screenshotOpts);
  });

  test("inputs", async ({ page }) => {
    await openPlayground(page);
    const section = page.locator("#section-inputs");
    await expect(section).toHaveScreenshot("inputs.png", screenshotOpts);
  });

  test("cards", async ({ page }) => {
    await openPlayground(page);
    const section = page.locator("#section-cards");
    await expect(section).toHaveScreenshot("cards.png", screenshotOpts);
  });

  test("alerts", async ({ page }) => {
    await openPlayground(page);
    const section = page.locator("#section-alerts");
    await expect(section).toHaveScreenshot("alerts.png", screenshotOpts);
  });

  test("draft conflicts panel section is present", async ({ page }) => {
    await openPlayground(page);
    const section = page.locator("#section-draft-conflicts");
    await expect(section.getByRole("heading", { name: "Conflict-ridden drafts" })).toBeVisible();
  });
});
