import { expect, test } from "@playwright/test";

/**
 * RSC/layout tenant path: middleware injects `x-tenant-slug` for known workspace hosts.
 * Skipped in CI when workspace DNS/API seed is unavailable.
 */
test.describe("workspace host (RSC path)", () => {
  test.skip(!!process.env.CI, "requires ws1-rbac.localhost → 127.0.0.1 and seeded tenant");

  test("known workspace host serves login (not workspace-not-found)", async ({ page }) => {
    const res = await page.goto("http://ws1-rbac.localhost:3000/login", {
      waitUntil: "domcontentloaded",
    });
    expect(res?.status() ?? 0).toBeLessThan(500);
    await expect(page).not.toHaveURL(/workspace-not-found/);
    await expect(page.locator("body")).toContainText("ورود");
  });
});
