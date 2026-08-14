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

test.beforeAll(async ({ playwright, baseURL }) => {
  const request = await playwright.request.newContext({
    baseURL:
      baseURL ??
      process.env.SMOKE_MARKETING_BASE_URL ??
      "http://operator.localhost:3002",
  });
  try {
    const detailResponse = await request.get(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, {
      timeout: 180_000,
    });
    expect(detailResponse.ok()).toBeTruthy();
    const detailHtml = await detailResponse.text();
    const embeddedUrl = detailHtml.match(/data-marketing-dialog-src="([^"]+)"/)?.[1] ?? null;
    expect(embeddedUrl).toBeTruthy();
    if (embeddedUrl !== null) {
      const embeddedResponse = await request.get(embeddedUrl, { timeout: 180_000 });
      expect(embeddedResponse.ok()).toBeTruthy();
    }
  } finally {
    await request.dispose();
  }
});

async function openSmokeTourDetail(page: import("@playwright/test").Page): Promise<void> {
  const detailLink = page.locator(`a[href="/tours/${SMOKE_PUBLISHED_TOUR_ID}"]`).first();
  await detailLink.click();
}

async function warmEmbeddedRegistrationRoute(
  page: import("@playwright/test").Page,
  trigger: import("@playwright/test").Locator
): Promise<void> {
  const embeddedUrl = await trigger.getAttribute("data-marketing-dialog-src");
  expect(embeddedUrl).toBeTruthy();
  if (embeddedUrl === null) {
    throw new Error("Expected embedded registration URL on marketing CTA");
  }
  const response = await page.request.get(embeddedUrl, { timeout: 180_000 });
  expect(response.ok()).toBeTruthy();
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

test("SMK-MKT-03 marketing register CTA completes OTP + Denali intake", async ({ page }) => {
  const devPhone = `+1555${String(Date.now()).slice(-7)}`;
  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-registration-dialog]")).toHaveAttribute(
    "data-marketing-registration-dialog-ready",
    "true",
    { timeout: 30_000 }
  );

  const registerLink = page.locator("[data-marketing-register]").first();
  await expect(registerLink).toBeVisible();
  await warmEmbeddedRegistrationRoute(page, registerLink);
  await registerLink.click();

  const dialog = page.locator("[data-marketing-registration-dialog]");
  await expect(dialog).toHaveAttribute("data-marketing-registration-dialog-open", "true", {
    timeout: 30_000,
  });
  await expect(
    page.locator(
      '[data-marketing-registration-dialog-frame][src*="/catalog/"][src*="embed=marketing"]'
    )
  ).toBeVisible({ timeout: 30_000 });
  const embeddedRegistration = page.frameLocator("[data-marketing-registration-dialog-frame]");
  await expect(embeddedRegistration.locator("[data-public-registration-phone]")).toBeVisible({
    timeout: 120_000,
  });

  await submitCatalogPhoneForOtp(page, devPhone, embeddedRegistration);

  await fillCatalogOtp(page, CATALOG_DEV_OTP, embeddedRegistration);
  await expect(
    embeddedRegistration.locator(
      "[data-public-registration-profile], [data-public-registration-intake]"
    )
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, embeddedRegistration, {
    email: REGISTRATION_EMAIL,
    fullName: "Marketing Smoke Guest",
    partySize: "2",
  });

  await expect(embeddedRegistration.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible();
});

test("SMK-MKT-03b marketing detail keeps guest registration inside modal iframe", async ({
  page,
}) => {
  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-registration-dialog]")).toHaveAttribute(
    "data-marketing-registration-dialog-ready",
    "true",
    { timeout: 30_000 }
  );

  const detailUrl = page.url();
  const registerLink = page.locator("[data-marketing-register]").first();
  await expect(registerLink).toBeVisible();
  await warmEmbeddedRegistrationRoute(page, registerLink);
  await registerLink.click();

  const dialog = page.locator("[data-marketing-registration-dialog]");
  await expect(dialog).toHaveAttribute("data-marketing-registration-dialog-open", "true", {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(detailUrl);

  const registrationFrame = page.locator(
    '[data-marketing-registration-dialog-frame][src*="/catalog/"][src*="embed=marketing"]'
  );
  await expect(registrationFrame).toBeVisible();

  const embeddedRegistration = page.frameLocator("[data-marketing-registration-dialog-frame]");
  await expect(embeddedRegistration.locator("[data-portal-auth-experience]")).toBeVisible({
    timeout: 120_000,
  });
  await expect(embeddedRegistration.locator("[data-public-registration-phone]")).toBeVisible({
    timeout: 120_000,
  });
  await expect(embeddedRegistration.locator("#phone")).toBeVisible();
  await expect(page).toHaveURL(detailUrl);
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible();
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

test("SMK-MKT-04 tour detail renders multi-day itinerary and segment photos", async ({ page }) => {
  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-itinerary]")).toBeVisible();
  await expect(page.getByText("Summit push")).toBeVisible();
  await expect(page.getByText(/Ridge ascent/)).toBeVisible();
  await expect(page.locator("[data-marketing-catalog-segment-photos] img")).toHaveCount(1);
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
