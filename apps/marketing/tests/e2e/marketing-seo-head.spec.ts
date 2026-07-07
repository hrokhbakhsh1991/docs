import { expect, test } from "@playwright/test";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";

test("SMK-MKT-07 tour detail exposes title, og:title, and twitter:card", async ({ page }) => {
  await page.goto(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });

  await expect(page).toHaveTitle(/.+/);
  const ogTitle = page.locator('meta[property="og:title"]');
  await expect(ogTitle).toHaveCount(1);
  const ogTitleContent = await ogTitle.getAttribute("content");
  expect(ogTitleContent?.trim().length ?? 0).toBeGreaterThan(0);

  const twitterCard = page.locator('meta[name="twitter:card"]');
  await expect(twitterCard).toHaveCount(1);
  const cardValue = await twitterCard.getAttribute("content");
  expect(["summary", "summary_large_image"]).toContain(cardValue);
});
