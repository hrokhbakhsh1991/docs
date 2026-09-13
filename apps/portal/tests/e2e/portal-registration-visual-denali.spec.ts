import { mkdirSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";
import { DENALI_SMOKE_PUBLISHED_TOUR_ID } from "./fixtures/complete-portal-registration";

const ARTIFACT_DIR = join(process.cwd(), "apps/portal/.artifacts/2026-08-15-registration-audit");

test.describe.configure({ mode: "serial" });

async function reachRegistrationIntake(page: import("@playwright/test").Page, phone: string) {
  await page.context().clearCookies();
  await page.goto("/health");
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await gotoPortalRegistration(page, DENALI_SMOKE_PUBLISHED_TOUR_ID);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Portal Registration Visual");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/api/public-auth/register-complete"),
        { timeout: 60_000 }
      ),
      page.locator('[data-action="profile-continue"]').click(),
    ]);
    expect(
      response.ok(),
      `register-complete failed (${response.status()}): ${(await response.text()).slice(0, 240)}`
    ).toBeTruthy();
  }

  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 60_000,
  });
}

test("VIS-REG-01 denali registration intake desktop + mobile artifacts", async ({ page }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });

  const desktopPhone = `+1555${String(Date.now()).slice(-7)}`;
  await page.setViewportSize({ width: 1440, height: 1280 });
  await reachRegistrationIntake(page, desktopPhone);
  await page.waitForLoadState("networkidle");
  await page.locator("[data-denali-add-guest]").click();
  await expect(page.locator("[data-denali-other-guest-card]")).toHaveCount(1);
  await expect(page.locator("[data-denali-remove-guest]")).toHaveCount(1);
  await page.screenshot({
    path: join(ARTIFACT_DIR, "registration-desktop-companion-v2.png"),
    fullPage: true,
  });
  await page.locator("[data-denali-remove-guest]").click();
  await expect(page.locator("[data-denali-other-guest-card]")).toHaveCount(0);
  await page.locator("[data-denali-undo-guest]").click();
  await expect(page.locator("[data-denali-other-guest-card]")).toHaveCount(1);

  const mobilePhone = `+1555${String(Date.now() + 1).slice(-7)}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await reachRegistrationIntake(page, mobilePhone);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(ARTIFACT_DIR, "registration-mobile-v2.png"),
    fullPage: true,
  });
});
