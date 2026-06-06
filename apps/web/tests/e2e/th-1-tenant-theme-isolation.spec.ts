import { expect, test } from "@playwright/test";

/**
 * TH-1 — tenant-a accent ≠ tenant-b (MAP 4.4 / test-matrix).
 * @see docs/phase-4/appendices/th-1-playwright-e2e.md
 */
const TENANT_A_PRIMARY = "#2563eb";
const TENANT_B_PRIMARY = "#dc2626";

async function readPrimaryColor(page: import("@playwright/test").Page): Promise<string> {
  const theme = page.locator("[data-tenant-theme]").first();
  await expect(theme).toBeVisible({ timeout: 30_000 });
  return theme.evaluate((el) => getComputedStyle(el).getPropertyValue("--color-primary").trim());
}

test.describe("TH-1 tenant theme isolation", () => {
  test("tenant-a and tenant-b expose distinct --color-primary", async ({ page }) => {
    await page.goto("http://tenant-a.localhost:3000/");
    const colorA = await readPrimaryColor(page);
    expect(colorA.toLowerCase()).toBe(TENANT_A_PRIMARY);

    await page.goto("http://tenant-b.localhost:3000/");
    const colorB = await readPrimaryColor(page);
    expect(colorB.toLowerCase()).toBe(TENANT_B_PRIMARY);

    expect(colorA).not.toEqual(colorB);
  });
});
