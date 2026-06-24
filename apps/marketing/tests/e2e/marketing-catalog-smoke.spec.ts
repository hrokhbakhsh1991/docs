import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  submitCatalogPhoneForOtp,
} from "./fixtures/catalog-registration-otp";

const OPERATOR_PUBLISHED_TOUR_TITLE = "North Ridge Trek";
const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const REGISTRATION_EMAIL = `smk-mkt-03-${Date.now()}@denali-smoke.local`;

async function openOperatorTourDetail(page: import("@playwright/test").Page): Promise<void> {
  await page.locator(`a[href="/tours/${OPERATOR_PUBLISHED_TOUR_ID}"]`).first().click();
}

test("SMK-MKT-01 denali operator public catalog browse", async ({ page, context }) => {
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(false);

  await page.goto("/tours");
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-header]")).toBeVisible();
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible();
});

test("SMK-MKT-03 marketing register CTA completes OTP + Denali intake", async ({ page }) => {
  const devPhone = `+1555${String(Date.now()).slice(-7)}`;
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await openOperatorTourDetail(page);
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });

  const registerLink = page.locator("[data-marketing-register]");
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
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await openOperatorTourDetail(page);
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await page.locator("[data-marketing-catalog-tour-detail] a[href='/tours']").click();
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
});

test("SMK-MKT-04 tour detail renders multi-day itinerary and segment photos", async ({ page }) => {
  await page.goto(`/tours/${OPERATOR_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-itinerary]")).toBeVisible();
  await expect(page.getByText("Summit push")).toBeVisible();
  await expect(page.getByText(/Ridge ascent/)).toBeVisible();
  await expect(page.locator("[data-marketing-catalog-segment-photos] img")).toHaveCount(1);
});
