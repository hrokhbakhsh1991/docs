/**
 * Manual walkthrough — Denali workspace guest purchase flow (P6-1 + P6-3).
 * Not part of CI smokes; delete after local verification if desired.
 */
import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";

const DENALI_TOUR_ID = "5387d014-ee64-465a-9187-9b755eba04bb";
const DENALI_TOUR_TITLE = "تور جدید الالالا";
const MARKETING_BASE = "http://denali.localhost:3002";

test.describe("Denali workspace purchase flow", () => {
  test("marketing CTA → portal register → intake → /me/registrations", async ({ page }) => {
    const email = `denali-flow-${Date.now()}@denali-smoke.local`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await page.goto(`${MARKETING_BASE}/tours`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 120_000 });
    await expect(page.getByText(DENALI_TOUR_TITLE).first()).toBeVisible({ timeout: 60_000 });

    await page.locator(`a[href="/tours/${DENALI_TOUR_ID}"]`).first().click();
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });

    const registerLink = page.locator("[data-marketing-register]");
    await expect(registerLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/denali\.portal\.localhost:3003\/catalog\/[^/]+\/register/, {
        timeout: 120_000,
      }),
      registerLink.click(),
    ]);

    await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
      timeout: 120_000,
    });
    await expect(page.locator("[data-catalog-registration-page]")).toBeVisible();

    await requestRegistrationOtp(page, phone);
    await fillCatalogOtp(page, CATALOG_DEV_OTP);
    await expect(
      page.locator("[data-public-registration-profile], [data-public-registration-intake]")
    ).toBeVisible({ timeout: 60_000 });

    await completeCatalogRegistrationIntake(page, {
      email,
      fullName: "Denali Flow Guest",
      partySize: "2",
    });

    await expect(page.locator("[data-public-registration-success]")).toBeVisible({
      timeout: 60_000,
    });

    await page.locator('[data-public-registration-success] a[href="/me/registrations"]').click();
    await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(DENALI_TOUR_TITLE)).toBeVisible();
  });
});
