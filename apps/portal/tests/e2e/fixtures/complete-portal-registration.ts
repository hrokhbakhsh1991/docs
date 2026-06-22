import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
} from "./catalog-registration-otp";

export const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
export const OPERATOR_PUBLISHED_TOUR_TITLE = "North Ridge Trek";

export async function completePortalCatalogRegistration(
  page: Page,
  input: {
    readonly tourId?: string;
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
    readonly partySize?: string;
  }
): Promise<void> {
  const tourId = input.tourId ?? OPERATOR_PUBLISHED_TOUR_ID;
  await page.goto(`/catalog/${tourId}/register`);
  await expect(page.locator("[data-public-registration-phone]")).toBeVisible({ timeout: 60_000 });

  await page.getByLabel(/Mobile|موبایل/).fill(input.phone);
  await page.locator('[data-action="send-code"]').click();
  await expect(page.locator("[data-public-registration-otp]")).toBeVisible({ timeout: 60_000 });

  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    email: input.email,
    fullName: input.fullName,
    partySize: input.partySize ?? "2",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
}
