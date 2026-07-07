import { expect, test } from "@playwright/test";

test("SMK-MKT-09 English tours page exposes reciprocal hreflang", async ({ page }) => {
  await page.goto("/en/tours", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });

  const canonical = page.locator('link[rel="canonical"]');
  await expect(canonical).toHaveAttribute("href", /\/en\/tours$/);

  const fa = page.locator('link[rel="alternate"][hreflang="fa-IR"]');
  await expect(fa).toHaveAttribute("href", /\/tours$/);

  const en = page.locator('link[rel="alternate"][hreflang="en-US"]');
  await expect(en).toHaveAttribute("href", /\/en\/tours$/);

  const fallback = page.locator('link[rel="alternate"][hreflang="x-default"]');
  await expect(fallback).toHaveAttribute("href", /\/tours$/);
});
