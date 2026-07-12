import { expect, test } from "@playwright/test";

import { resolveSmokePublishedTourId } from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();
const OPERATOR_DRAFT_TOUR_ID = "00000000-0000-4000-8000-000000000211";

test("SMK-MKT-14 draft tour detail returns 404 with noindex", async ({ page, request }) => {
  const draftResponse = await page.goto(`/tours/${OPERATOR_DRAFT_TOUR_ID}`, {
    waitUntil: "domcontentloaded",
  });
  expect(draftResponse?.status()).toBe(404);
  await expect(page.locator("[data-marketing-not-found]")).toBeVisible({ timeout: 60_000 });

  const robots = page.locator('meta[name="robots"]').first();
  await expect(robots).toHaveAttribute("content", /noindex/i);

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const sitemapBody = await sitemapResponse.text();
  expect(sitemapBody).toContain(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`);
  expect(sitemapBody).not.toContain(`/tours/${OPERATOR_DRAFT_TOUR_ID}`);
});
