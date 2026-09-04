/**
 * Manual UX probe — Denali multi-guest partial duplicate (no CI smokes).
 *
 * Goal: ensure per-card partial error rendering works when some POSTs fail.
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

test("Denali other: 10 guests → expect partial failure UI", async ({ page }) => {
  await gotoPortalRegistration(page, DENALI_TOUR_ID);

  await requestRegistrationOtp(page, DEV_PHONE);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: "Denali Dup Guest",
    registrantTarget: "other",
    phone: DEV_PHONE,
    guestCount: 10,
    expectSuccess: false,
  });

  await expect(page.locator("[data-denali-submit-results]")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("[data-denali-submit-result-error]").first()).toBeVisible({
    timeout: 10_000,
  });
});
