import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./catalog-registration-otp";

export const DENALI_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";
export const OPERATOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000210";
export const OPERATOR_SMOKE_PARTICIPANT_TOUR_ID = "00000000-0000-4000-8000-000000000212";
export const OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID = "00000000-0000-4000-8000-000000000213";
export const OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID = "00000000-0000-4000-8000-000000000214";
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
  await page.context().clearCookies();
  await gotoPortalRegistration(page, tourId);

  await requestRegistrationOtp(page, input.phone);

  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: input.fullName,
    partySize: input.partySize ?? "2",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
}
