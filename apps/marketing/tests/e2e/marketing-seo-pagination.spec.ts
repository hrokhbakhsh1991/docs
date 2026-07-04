import { expect, test } from "@playwright/test";

test("SMK-MKT-10 paginated tours list emits noindex follow robots meta", async ({ page }) => {
  await page.goto("/tours?cursor=test-cursor", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });

  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(1);
  const content = await robots.getAttribute("content");
  expect(content).toMatch(/noindex/i);
  expect(content).toMatch(/follow/i);
});

test("SMK-MKT-17 filtered tours list emits noindex follow robots meta", async ({ page }) => {
  await page.goto("/tours?category=mountain", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });

  const robots = page.locator('meta[name="robots"]');
  await expect(robots).toHaveCount(1);
  const content = await robots.getAttribute("content");
  expect(content).toMatch(/noindex/i);
  expect(content).toMatch(/follow/i);
});
