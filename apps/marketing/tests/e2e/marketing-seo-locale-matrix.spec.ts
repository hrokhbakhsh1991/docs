import { expect, test } from "@playwright/test";

const DENALI_BASE = process.env.SMOKE_DENALI_BASE_URL ?? "http://operator.localhost:3002";
const URBAN_BASE = process.env.SMOKE_URBAN_BASE_URL ?? "http://urban.localhost:3002";

async function assertHreflangMatrix(
  page: import("@playwright/test").Page,
  baseUrl: string,
  englishPath: string,
) {
  await page.goto(`${baseUrl}${englishPath}/tours`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", new RegExp(`${englishPath}/tours$`));

  const fa = page.locator('link[rel="alternate"][hreflang="fa-IR"]');
  await expect(fa).toHaveAttribute("href", /\/tours$/);

  const en = page.locator('link[rel="alternate"][hreflang="en-US"]');
  await expect(en).toHaveAttribute("href", new RegExp(`${englishPath}/tours$`));

  const fallback = page.locator('link[rel="alternate"][hreflang="x-default"]');
  await expect(fallback).toHaveAttribute("href", /\/tours$/);
}

test("SMK-MKT-15 denali fa/en tours pages expose reciprocal hreflang", async ({ page }) => {
  await page.goto(`${DENALI_BASE}/tours`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await assertHreflangMatrix(page, DENALI_BASE, "/en");
});

test("SMK-MKT-15 urban fa/en tours pages expose reciprocal hreflang", async ({ page }) => {
  await page.goto(`${URBAN_BASE}/tours`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await assertHreflangMatrix(page, URBAN_BASE, "/en");
});
