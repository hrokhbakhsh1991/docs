import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";

const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
const REGISTRATION_EMAIL = `smk-ptl-01-${Date.now()}@denali-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-01 portal catalog registration (OTP + intake)", async ({ page }) => {
  await gotoPortalRegistration(page, OPERATOR_PUBLISHED_TOUR_ID);

  await requestRegistrationOtp(page, DEV_PHONE);

  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 60_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Portal Smoke Guest");
    await page.locator('[data-action="profile-continue"]').click();
  }

  await expect(
    page.locator("[data-public-registration-intake][data-registration-ready]")
  ).toBeVisible({ timeout: 120_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: "Portal Smoke Guest",
    partySize: "2",
    registrantTarget: "self",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
});
