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

const MEMBER_SESSION_COOKIE = "atour_mb_session";

/**
 * PCMS-COOK-01 + PCMS-REG-01 on custom apex hosts (portal.denali.club).
 * @see docs/standards/member-session-portal-authority.mdoc
 */
test("SMK-PTL-08 custom apex cookie domain + registration resume without OTP", async ({
  page,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await page.context().clearCookies();
  await gotoPortalRegistration(page, OPERATOR_PUBLISHED_TOUR_ID);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: "Custom Apex PCMS Guest",
    partySize: "1",
  });
  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });

  const cookies = await page.context().cookies();
  const memberSession = cookies.find((cookie) => cookie.name === MEMBER_SESSION_COOKIE);
  expect(memberSession).toBeDefined();
  expect(memberSession!.domain.replace(/^\./, "")).toBe("denali.club");

  await page.goto(`/catalog/${OPERATOR_SMOKE_PARTICIPANT_TOUR_ID}/register`, {
    waitUntil: "domcontentloaded",
  });

  await expect(page.locator('[data-registration-resume="intake"]').first()).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator("[data-public-registration-phone]")).toHaveCount(0);
  await expect(page.locator("[data-public-registration-intake]")).toBeVisible({
    timeout: 60_000,
  });
});
