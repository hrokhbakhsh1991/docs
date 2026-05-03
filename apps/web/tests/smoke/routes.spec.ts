import { expect, test } from "@playwright/test";

test.describe("route smoke", () => {
  test("/dashboard loads", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("body")).toContainText("Dashboard");
  });

  test("/login loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toContainText("Login");
  });

  test("/auth/login loads (legacy path)", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator("body")).toContainText("Login");
  });
});
