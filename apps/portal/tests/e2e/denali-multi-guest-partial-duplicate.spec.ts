/**
 * Manual UX probe — Denali multi-guest partial duplicate (no CI smokes).
 *
 * Goal: ensure per-card partial error rendering works when some POSTs fail.
 */
import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "./fixtures/catalog-registration-otp";

// Use seeded smoke tour id (warmed in `portal-smoke-global-setup.ts`).
const DENALI_TOUR_ID = process.env.DENALI_TOUR_ID ?? "00000000-0000-4000-8000-000000000212";
test.describe.configure({ mode: "serial" });

test("Denali other: 10 guests → expect partial failure UI", async ({ page }) => {
  const devPhone = syntheticTestPhone();
  const duplicateNationalId = syntheticNationalId();
  const guestPhoneSuffix = Number(devPhone.slice(-7));
  const registrationStatuses: number[] = [];
  page.on("response", (response) => {
    if (
      response.request().method() === "POST" &&
      response.url().includes("/api/catalog/registrations")
    ) {
      registrationStatuses.push(response.status());
    }
  });

  await gotoPortalRegistration(page, DENALI_TOUR_ID);

  await requestRegistrationOtp(page, devPhone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    fullName: "Denali Dup Guest",
    registrantTarget: "other",
    phone: devPhone,
    guestCount: 10,
    expectSuccess: false,
    // Keep a run-unique national ID shared across these guests so the first
    // POST succeeds and following sequential POSTs exercise duplicate handling.
    guestOverrides: (index) => ({
      fullName: `Denali Dup Guest ${index + 1}`,
      phone: `+1555${String((guestPhoneSuffix + index + 1) % 10_000_000).padStart(7, "0")}`,
      nationalId: duplicateNationalId,
    }),
  });

  await expect(page.locator("[data-denali-submit-results]")).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.locator("[data-denali-submit-result-error]").first()).toBeVisible({
    timeout: 10_000,
  });

  expect(registrationStatuses).toContain(201);
  expect(registrationStatuses).toContain(409);
});

test("Denali other: concurrent duplicate submissions yield one 201 and one 409", async ({
  page,
}) => {
  const phone = syntheticTestPhone();
  await gotoPortalRegistration(page, DENALI_TOUR_ID);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  const profile = page.locator("[data-public-registration-profile]");
  if (await profile.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Concurrent Duplicate Probe");
    await page.locator('[data-action="profile-continue"]').click();
  }
  await page
    .locator("[data-public-registration-intake][data-registration-ready]")
    .waitFor({ state: "visible", timeout: 120_000 });

  const payload = {
    tourId: DENALI_TOUR_ID,
    fullName: "Concurrent Duplicate Probe",
    email: `concurrent-duplicate-${Date.now()}@denali.local`,
    phone,
    partySize: 1,
    nationalId: syntheticNationalId(),
    fatherName: "Smoke Father",
    birthDate: "1990-01-15",
    registrantTarget: "other",
  };

  const responses = await Promise.all([
    page.request.post("/api/catalog/registrations", {
      headers: { "Idempotency-Key": `concurrent-duplicate-a-${Date.now()}` },
      data: payload,
    }),
    page.request.post("/api/catalog/registrations", {
      headers: { "Idempotency-Key": `concurrent-duplicate-b-${Date.now()}` },
      data: payload,
    }),
  ]);
  const statuses = responses.map((response) => response.status()).sort((a, b) => a - b);
  expect(statuses).toEqual([201, 409]);
});
