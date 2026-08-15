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

const ARTIFACT_DIR = join(
  process.cwd(),
  "apps/portal/.artifacts/2026-08-15-registration-audit"
);

test.describe.configure({ mode: "serial" });

async function reachRegistrationIntake(page: import("@playwright/test").Page, phone: string) {
  await page.context().clearCookies();
  await gotoPortalRegistration(page, DENALI_SMOKE_PUBLISHED_TOUR_ID);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Portal Registration Visual");
    await page.locator('[data-action="profile-continue"]').click();
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
  await page.screenshot({
    path: join(ARTIFACT_DIR, "registration-desktop-v2.png"),
    fullPage: true,
  });

  const mobilePhone = `+1555${String(Date.now() + 1).slice(-7)}`;
  await page.setViewportSize({ width: 390, height: 844 });
  await reachRegistrationIntake(page, mobilePhone);
  await page.waitForLoadState("networkidle");
  await page.screenshot({
    path: join(ARTIFACT_DIR, "registration-mobile-v2.png"),
    fullPage: true,
  });
});
