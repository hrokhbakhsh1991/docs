import { expect, test } from "@playwright/test";

test.describe("tour create wizard (new)", () => {
  test("/tours/new responds without server error", async ({ page }) => {
    const res = await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    expect(res?.status()).toBeDefined();
    expect(res!.status()).toBeLessThan(500);
  });
});
