import { expect, test } from "@playwright/test";

test.describe("route smoke", () => {
  test("/dashboard loads", async ({ page }) => {
    const res = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    // Default locale FA: unauthenticated users are redirected to `/login`.
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.locator("body")).toContainText("ورود");
  });

  test("/login loads", async ({ page }) => {
    const res = await page.goto("/login", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toContainText("ورود");
  });

  test("/auth/login loads (legacy path)", async ({ page }) => {
    const res = await page.goto("/auth/login", { waitUntil: "domcontentloaded" });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page.locator("body")).toContainText("ورود");
  });
});
