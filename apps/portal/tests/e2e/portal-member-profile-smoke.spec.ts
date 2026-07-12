import { expect, test } from "@playwright/test";

import {
  completePortalCatalogRegistration,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
} from "./fixtures/complete-portal-registration";
import {
  DENALI_PROFILE_BIRTH_DATE,
  DENALI_PROFILE_FATHER_NAME,
  DENALI_PROFILE_NATIONAL_ID,
  gotoMemberProfile,
  openRegistrationIntakeForAuthenticatedMember,
  saveMemberProfileFields,
} from "./fixtures/portal-member-profile";

const PROFILE_EMAIL = `den-prof-${Date.now()}@denali-smoke.local`;
let authenticatedPhone = `+1555${String(Date.now()).slice(-7)}`;

test.beforeEach(async ({ page }) => {
  authenticatedPhone = `+1555${String(Date.now()).slice(-7)}`;
  await completePortalCatalogRegistration(page, {
    email: PROFILE_EMAIL,
    fullName: "Denali Profile Smoke",
    phone: authenticatedPhone,
  });
});

test("DEN-PROF-01 Denali /me/profile shows identity and participant fields", async ({ page }) => {
  await gotoMemberProfile(page);

  await expect(page.locator('[data-member-profile-field="displayName"] input')).toBeVisible();
  await expect(page.locator('[data-member-profile-field="email"] input')).toBeVisible();
  await expect(page.locator('[data-member-profile-field="mobile"]')).toBeVisible();
  await expect(page.locator('[data-member-profile-field="nationalId"] input')).toBeVisible();
  await expect(page.locator('[data-member-profile-field="fatherName"] input')).toBeVisible();
  await expect(page.locator('[data-member-profile-field="birthDate"] input')).toBeVisible();
  await expect(page.locator('[data-member-profile-field="gender"] select')).toBeVisible();
  await expect(page.locator("[data-member-profile-mobile-change]")).toBeVisible();
  await expect(page.locator("[data-member-profile-save]")).toBeVisible();
});

test("DEN-PROF-04 mobile change via OTP updates profile mobile", async ({ page }) => {
  const newMobile = `+1555${String(Date.now()).slice(-7)}`;

  await gotoMemberProfile(page);
  await page.locator("[data-member-profile-mobile-change-start]").click();
  await page.locator("#profile-mobile-change-phone").fill(newMobile.replace(/\D/g, ""));
  await page.locator('[data-member-profile-mobile-change-request] button').first().click();
  await expect(page.locator('[data-member-profile-mobile-change-verify]')).toBeVisible({
    timeout: 60_000,
  });
  await page.locator("#profile-mobile-change-otp").fill("1234");
  const [verifyResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/me/mobile/verify"),
      { timeout: 90_000 }
    ),
    page.locator('[data-member-profile-mobile-change-verify] button').first().click(),
  ]);
  expect(verifyResponse.ok()).toBeTruthy();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("main[data-portal-member-profile]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('[data-member-profile-mobile-change]')).toContainText(
    newMobile.replace(/\D/g, ""),
    { timeout: 15_000 }
  );
});

test("DEN-PROF-02 profile PATCH persists and intake omits saved nationalId", async ({ page }) => {
  await gotoMemberProfile(page);
  await saveMemberProfileFields(page, {
    nationalId: DENALI_PROFILE_NATIONAL_ID,
    fatherName: DENALI_PROFILE_FATHER_NAME,
    birthDate: DENALI_PROFILE_BIRTH_DATE,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("main[data-portal-member-profile]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('[data-member-profile-field="nationalId"] input')).toHaveValue(
    DENALI_PROFILE_NATIONAL_ID
  );
  await expect(page.locator('[data-member-profile-field="fatherName"] input')).toHaveValue(
    DENALI_PROFILE_FATHER_NAME
  );
  await expect(page.locator('[data-member-profile-field="birthDate"] input')).toHaveValue(
    DENALI_PROFILE_BIRTH_DATE
  );

  await openRegistrationIntakeForAuthenticatedMember(
    page,
    authenticatedPhone,
    OPERATOR_SMOKE_PARTICIPANT_TOUR_ID
  );
  await expect(page.locator('[data-intake-field="nationalId"]')).toHaveCount(0);
  await expect(page.locator('[data-intake-field="fatherName"]')).toHaveCount(0);
  await expect(page.locator('[data-intake-field="birthDate"]')).toHaveCount(0);
});

test("DEN-PROF-03 intake hides nationalId when profile already has it", async ({ page }) => {
  await gotoMemberProfile(page);
  await saveMemberProfileFields(page, {
    nationalId: DENALI_PROFILE_NATIONAL_ID,
  });

  await openRegistrationIntakeForAuthenticatedMember(
    page,
    authenticatedPhone,
    OPERATOR_SMOKE_PARTICIPANT_TOUR_ID
  );
  await expect(page.locator('[data-intake-field="nationalId"]')).toHaveCount(0);
});

test("DEN-PROF-05 gender select PATCH persists after reload", async ({ page }) => {
  await gotoMemberProfile(page);
  await saveMemberProfileFields(page, {
    gender: "female",
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("main[data-portal-member-profile]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator('[data-member-profile-field="gender"] select')).toHaveValue("female");
});
