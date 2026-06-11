import { expect, test } from "@playwright/test";

const DENALI_PRIMARY = "#0f766e";

/**
 * Denali operator skin — body-scoped shadcn bridge (portal-safe).
 * @see docs/workspaces/denali/admin-experience.md
 */
test.describe("Denali admin theme smoke", () => {
  test("denali host sets workspace plugin and green primary on body", async ({ page }) => {
    await page.goto("http://denali.localhost:3000/auth/login");
    const plugin = await page.locator("body").getAttribute("data-workspace-plugin");
    expect(plugin).toBe("denali");

    const primary = await page.locator("body").evaluate((el) =>
      getComputedStyle(el).getPropertyValue("--primary").trim()
    );
    expect(primary.toLowerCase()).toBe(DENALI_PRIMARY);
  });
});
