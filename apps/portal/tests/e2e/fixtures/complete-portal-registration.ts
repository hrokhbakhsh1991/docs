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
export const DENALI_BOOKING_PAID_AUTO_TOUR_ID = "00000000-0000-4000-8000-000000000223";
export const DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID = "00000000-0000-4000-8000-000000000226";
export const DENALI_BOOKING_FREE_MANUAL_TOUR_ID = "00000000-0000-4000-8000-000000000224";
export const DENALI_BOOKING_FREE_AUTO_TOUR_ID = "00000000-0000-4000-8000-000000000225";
export const DENALI_BOOKING_FREE_AUTO_DISCOUNT_TOUR_ID = "00000000-0000-4000-8000-000000000227";
export const DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID = "00000000-0000-4000-8000-000000000228";
export const OPERATOR_PUBLISHED_TOUR_TITLE = "North Ridge Trek";

export function resolvePortalSmokeTourId(): string {
  const base = process.env.SMOKE_PORTAL_BASE_URL ?? "";
  return base.includes("denali") ? DENALI_SMOKE_PUBLISHED_TOUR_ID : OPERATOR_PUBLISHED_TOUR_ID;
}

export async function completePortalCatalogRegistration(
  page: Page,
  input: {
    readonly tourId?: string;
    readonly email: string;
    readonly fullName: string;
    readonly phone: string;
    readonly guestPhone?: string;
    readonly nationalId?: string;
    readonly partySize?: string;
    readonly registrantTarget?: "self" | "other";
  }
): Promise<void> {
  const tourId = input.tourId ?? resolvePortalSmokeTourId();
  const uniqueSmokeName = `${input.fullName} ${input.phone.replace(/\D/g, "").slice(-6)}`;
  await page.context().clearCookies();
  await gotoPortalRegistration(page, tourId);

  await requestRegistrationOtp(page, input.phone);

  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    // Denali rejects a repeated full name on the same tour in PostgreSQL.
    // Keep the human-readable case name while making reruns idempotent.
    fullName: uniqueSmokeName,
    // PostgreSQL enforces Denali's guest identity uniqueness across reruns;
    // derive a stable-valid value per smoke phone unless the case overrides it.
    nationalId: input.nationalId ?? input.phone.replace(/\D/g, "").slice(-10).padStart(10, "0"),
    partySize: input.partySize ?? "2",
    phone: input.guestPhone ?? input.phone,
    registrantTarget: input.registrantTarget,
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });

  // Pre-warm authenticated member trips SSR while the session cookie is fresh.
  await page.goto("/me/registrations", { waitUntil: "domcontentloaded" });
  await page
    .locator("[data-portal-member-registrations-list] li")
    .first()
    .waitFor({ state: "visible", timeout: 120_000 })
    .catch(() => undefined);
}
