import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./catalog-registration-otp";

export const URBAN_PORTAL_TOUR_ID = "00000000-0000-4000-8000-000000000410";
export const GUEST_CLUB_PORTAL_TOUR_ID = "00000000-0000-4000-8000-000000000420";

async function completeAuthAndProfile(
  page: Page,
  input: { readonly tourId: string; readonly fullName: string; readonly phone: string }
): Promise<void> {
  await page.context().clearCookies();
  await gotoPortalRegistration(page, input.tourId);
  await requestRegistrationOtp(page, input.phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 120_000 });

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible()) {
    await page.locator("#displayName").fill(input.fullName);
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      page.locator('[data-action="profile-continue"]').click(),
    ]);
    const body = await response.text();
    expect(
      response.ok(),
      `register-complete failed (${response.status()}): ${body.slice(0, 240)}`
    ).toBeTruthy();
    await page.locator("[data-public-registration-intake]").waitFor({
      state: "visible",
      timeout: 60_000,
    });
  }
}

export async function completeUrbanPortalRegistration(
  page: Page,
  input: {
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
    readonly tourId?: string;
  }
): Promise<void> {
  const tourId = input.tourId ?? URBAN_PORTAL_TOUR_ID;
  await completeAuthAndProfile(page, { tourId, fullName: input.fullName, phone: input.phone });

  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 120_000,
  });

  const fullNameField = page.locator('[data-intake-field="fullName"]');
  if (await fullNameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await fullNameField.fill(input.fullName);
  }
  const emailField = page.locator('[data-intake-field="email"]');
  if (await emailField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await emailField.fill(input.email);
  }
  const partySizeField = page.locator('[data-intake-field="partySize"]');
  if (await partySizeField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await partySizeField.fill("2");
  }

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/catalog/registrations"),
      { timeout: 120_000 }
    ),
    page.locator('[data-action="intake-submit"]').click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
}

export async function completeGuestClubPortalRegistration(
  page: Page,
  input: {
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
    readonly tourId?: string;
  }
): Promise<void> {
  const tourId = input.tourId ?? GUEST_CLUB_PORTAL_TOUR_ID;
  await completeAuthAndProfile(page, { tourId, fullName: input.fullName, phone: input.phone });

  const intake = page.locator("[data-public-registration-intake]");
  await intake.waitFor({ state: "visible", timeout: 120_000 });

  const fullNameField = intake.locator('[data-intake-field="fullName"]');
  if (await fullNameField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await fullNameField.fill(input.fullName);
  }
  const emailField = intake.locator('[data-intake-field="email"]');
  if (await emailField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await emailField.fill(input.email);
  }
  const partySizeField = intake.locator('[data-intake-field="partySize"]');
  if (await partySizeField.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await partySizeField.fill("2");
  }

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/catalog/registrations"),
      { timeout: 120_000 }
    ),
    page.locator('[data-action="intake-submit"]').click(),
  ]);
  expect(response.ok()).toBeTruthy();
  await expect(page.locator("[data-guest-club-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
}
