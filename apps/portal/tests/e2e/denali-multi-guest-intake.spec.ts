/**
 * Manual UX probe — Denali multi-guest intake add/remove (no CI smokes).
 */
import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";

// Use seeded smoke tour id (warmed in `portal-smoke-global-setup.ts`).
const DENALI_TOUR_ID = "00000000-0000-4000-8000-000000000212";
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test.describe.configure({ mode: "serial" });

test("Denali other: add 2 guests, remove to 1, submit, show other badge", async ({ page }) => {
  await gotoPortalRegistration(page, DENALI_TOUR_ID);

  await requestRegistrationOtp(page, DEV_PHONE);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: "Denali Other Guest",
    registrantTarget: "other",
    phone: DEV_PHONE,
    guestCount: 2,
    removeGuestsTo: 1,
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await expect(page.locator("[data-portal-member-registrant-other-badge]")).toBeVisible({
    timeout: 60_000,
  });
});
