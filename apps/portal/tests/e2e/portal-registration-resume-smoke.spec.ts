import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";
import {
  OPERATOR_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
} from "./fixtures/complete-portal-registration";

/**
 * PCMS-REG-01 — member with valid portal cookie skips OTP on a second tour register page.
 * @see docs/standards/member-session-portal-authority.mdoc
 */
test("SMK-PTL-07 second tour registration resumes at intake without OTP", async ({ page }) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await page.context().clearCookies();
  await gotoPortalRegistration(page, OPERATOR_PUBLISHED_TOUR_ID);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: "PCMS Resume Guest",
    partySize: "1",
  });
  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });

  await page.goto(`/catalog/${OPERATOR_SMOKE_PARTICIPANT_TOUR_ID}/register`, {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page.locator('[data-catalog-registration-page][data-registration-resume="intake"]')
  ).toBeVisible({ timeout: 120_000 });
  await expect(page.locator("[data-public-registration-phone]")).toHaveCount(0);
  await expect(page.locator("[data-public-registration-otp]")).toHaveCount(0);
  await expect(page.locator("[data-public-registration-intake]")).toBeVisible({
    timeout: 60_000,
  });
});
