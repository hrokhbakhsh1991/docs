/**
 * MANUAL-ONLY probe — requires marketing (:3002) + denali portal host binding.
 *
 * Not in CI smoke (`playwright.portal.config.ts`) and not in
 * `playwright.denali-probes.config.ts` (multi-guest seed tour probes).
 *
 * Prerequisites:
 * - marketing serving `denali.localhost:3002`
 * - portal on `denali.portal.localhost:3003` (legacy host for this walkthrough)
 * - live tour id below exists in Postgres (not the smoke seed `…000212`)
 *
 * Run only when intentionally verifying marketing→portal CTA:
 *   cd apps/portal && pnpm exec playwright test denali-purchase-flow.probe.spec.ts
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
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test.describe.configure({ mode: "serial" });

test.describe("Denali purchase flow (manual-only)", () => {
  test.skip(
    true,
    "manual-only: needs marketing:3002 + denali.portal host + non-seed tour — use denali-probes for CI-adjacent multi-guest"
  );

  test("Denali MKT browse → detail → portal register CTA", async ({ page }) => {
    await page.goto("http://denali.localhost:3002/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(DENALI_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });

    await page.locator(`a[href="/tours/${DENALI_TOUR_ID}"]`).first().first().click();
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });

    const registerLink = page.locator("[data-marketing-register]");
    await expect(registerLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/denali\.portal\.localhost.*\/catalog\/.*\/register/, { timeout: 60_000 }),
      registerLink.first().click(),
    ]);

    await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
      timeout: 120_000,
    });
    await expect(page.locator("[data-catalog-registration-page]")).toBeVisible();
    await expect(page.locator('body[data-workspace-plugin="denali"]')).toBeAttached();
  });

  test("Denali portal OTP + intake → success → /me/registrations", async ({ page }) => {
    await page.goto(`http://denali.portal.localhost:3003/catalog/${DENALI_TOUR_ID}/register`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
      timeout: 120_000,
    });

    await requestRegistrationOtp(page, DEV_PHONE);
    await fillCatalogOtp(page, CATALOG_DEV_OTP);
    await expect(
      page.locator("[data-public-registration-profile], [data-public-registration-intake]")
    ).toBeVisible({ timeout: 60_000 });

    await completeCatalogRegistrationIntake(page, {
      fullName: "Denali Probe Guest",
      partySize: "2",
      phone: DEV_PHONE,
    });

    await expect(page.locator("[data-public-registration-success]")).toBeVisible({
      timeout: 60_000,
    });

    await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
    await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(DENALI_TOUR_TITLE)).toBeVisible();
  });
});
