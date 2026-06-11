import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
} from "./fixtures/catalog-registration-otp";

const OPERATOR_PORTAL_BASE_URL =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://operator.localhost:3003";
const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const REGISTRATION_EMAIL = `smk-dreg-01-${Date.now()}@denali-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-DREG-01 denali public catalog registration (OTP + intake)", async ({ page }) => {
  await page.goto(`${OPERATOR_PORTAL_BASE_URL}/catalog/${OPERATOR_PUBLISHED_TOUR_ID}/register`);
  await expect(page.locator("[data-public-registration-phone]")).toBeVisible({ timeout: 60_000 });

  await page.getByLabel(/Mobile|موبایل/).fill(DEV_PHONE);
  await page.locator('[data-action="send-code"]').click();
  await expect(page.locator("[data-public-registration-otp]")).toBeVisible({ timeout: 60_000 });

  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Denali Smoke Guest",
    partySize: "2",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-urban-registration-success]")).toHaveCount(0);
});
