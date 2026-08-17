import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  submitCatalogPhoneForOtp,
} from "./fixtures/catalog-registration-otp";
import {
  resolveSmokePublishedTourId,
  SMOKE_PUBLISHED_TOUR_TITLE,
} from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();
const REGISTRATION_EMAIL = `smk-mkt-03-${Date.now()}@denali-smoke.local`;

async function openSmokeTourDetail(page: import("@playwright/test").Page): Promise<void> {
  const detailLink = page.locator(`a[href="/tours/${SMOKE_PUBLISHED_TOUR_ID}"]`).first();
  await detailLink.click();
}

test("SMK-MKT-01 denali operator public catalog browse", async ({ page, context }) => {
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(false);

  await page.goto("/tours");
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-header]")).toBeVisible();
  await expect(page.locator("[data-marketing-catalog-toolbar]")).toBeVisible();
  await expect(page.locator("[data-marketing-catalog-filters]")).toBeVisible();
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible();
});

test("SMK-MKT-17 denali catalog page matches current backend catalog batch", async ({
  page,
}) => {
  const response = await page.request.get("/api/catalog");
  expect(response.ok()).toBe(true);

  const payload = (await response.json()) as {
    readonly data?: { readonly items?: ReadonlyArray<{ readonly title?: string | null }> };
    readonly metadata?: { readonly nextCursor?: string | null };
  };
  const expectedItems = payload.data?.items ?? [];
  const expectedTitles = expectedItems
    .map((item) => item.title?.trim())
    .filter((title): title is string => title != null && title.length > 0);

  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-catalog-card]")).toHaveCount(expectedItems.length);

  for (const title of expectedTitles) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }

  const loadMore = page.locator("[data-marketing-catalog-pagination-next]");
  if (payload.metadata?.nextCursor == null) {
    await expect(loadMore).toHaveCount(0);
  } else {
    await expect(loadMore).toHaveCount(1);
  }
});

test("SMK-MKT-03 marketing register CTA completes OTP + Denali intake", async ({ page }) => {
  const devPhone = `+1555${String(Date.now()).slice(-7)}`;
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await openSmokeTourDetail(page);
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });

  const registerLink = page.locator("[data-marketing-register]").first();
  await expect(registerLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/catalog\/[^/]+\/register/, { timeout: 60_000 }),
    registerLink.click(),
  ]);
  await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
    timeout: 120_000,
  });

  await submitCatalogPhoneForOtp(page, devPhone);

  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Marketing Smoke Guest",
    partySize: "2",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
});

test("SMK-MKT-02 tour detail and back navigation", async ({ page }) => {
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await openSmokeTourDetail(page);
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-detail-jump-nav]")).toBeVisible();
  await expect(page.locator("[data-marketing-catalog-detail-faq]")).toBeVisible();
  await page.locator("[data-marketing-catalog-detail-back]").click();
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
});

test("SMK-MKT-04 tour detail renders multi-day itinerary; smoke photos stay empty (BUG-3)", async ({
  page,
}) => {
  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-itinerary]")).toBeVisible();
  await expect(page.getByText("Summit push")).toBeVisible();
  await expect(page.getByText(/Ridge ascent/)).toBeVisible();
  // Operator-smoke seeds use https://cdn.example/… — filtered as unreachable (BUG-3).
  await expect(page.locator("[data-marketing-catalog-segment-photos] img")).toHaveCount(0);
  await expect(page.locator("[data-marketing-catalog-segment-photos-empty]").first()).toBeVisible();
});

test("SMK-MKT-16 denali catalog server filter shows active pill and dismisses", async ({ page }) => {
  await page.goto("/tours?category=mountain", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.locator('[data-marketing-catalog-active-filter-id="category"]')).toBeVisible();

  await page.locator('[data-marketing-catalog-active-filter-id="category"]').click();
  await expect(page).toHaveURL(/\/tours(?:\?|$)/);
  await expect(page).not.toHaveURL(/category=/);
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible();
});
