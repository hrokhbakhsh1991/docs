import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";
import { gotoMemberProfile } from "./fixtures/portal-member-profile";
import {
  OPERATOR_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
} from "./fixtures/complete-portal-registration";

const INTAKE_PHONE = `+1555${String(Date.now()).slice(-7)}`;

async function reachIntakeStep(
  page: import("@playwright/test").Page,
  tourId: string,
  phone: string
): Promise<void> {
  await page.context().clearCookies();
  await gotoPortalRegistration(page, tourId);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Intake Smoke Guest");
    await page.locator('[data-action="profile-continue"]').click();
  }

  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 60_000,
  });
}

test("DEN-INTAKE-01 default smoke tour omits participant profile fields", async ({ page }) => {
  await reachIntakeStep(page, OPERATOR_PUBLISHED_TOUR_ID, INTAKE_PHONE);

  await expect(page.locator('[data-intake-field="nationalId"]')).toHaveCount(0);
  await expect(page.locator('[data-intake-field="fatherName"]')).toHaveCount(0);
  await expect(page.locator('[data-intake-field="birthDate"]')).toHaveCount(0);
  await expect(page.locator('[data-intake-field="partySize"]')).toHaveCount(0);
  await expect(page.locator("[data-public-registration-intake]")).toBeVisible();
});

test("DEN-INTAKE-02 participant tour shows required profile fields", async ({ page }) => {
  await reachIntakeStep(page, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID, INTAKE_PHONE);

  await expect(page.locator('[data-intake-field="nationalId"]')).toBeVisible();
  await expect(page.locator('[data-intake-field="fatherName"]')).toBeVisible();
  await expect(page.locator('[data-intake-field="birthDate"]')).toBeVisible();
});

test("DEN-INTAKE-03 other registrant tab shows participant fields on gated tour", async ({
  page,
}) => {
  await reachIntakeStep(page, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID, INTAKE_PHONE);

  await page.locator("[data-denali-registrant-self-toggle] input").click();
  await expect(page.locator('[data-intake-field="nationalId"]')).toBeVisible();
  await expect(page.locator('[data-intake-field="fullName"]')).toBeVisible();

  await completeCatalogRegistrationIntake(page, {
    fullName: "Guest For Other Tab",
    nationalId: "2234567890",
    fatherName: "Guest Father",
    birthDate: "1992-03-20",
    partySize: "1",
    registrantTarget: "other",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
});

test("DEN-INTAKE-04 self intake persists participant fields to member profile", async ({
  page,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const nationalId = "3344556677";
  const fatherName = "Intake Persist Father";
  const birthDate = "1993-04-10";

  await reachIntakeStep(page, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID, phone);

  await completeCatalogRegistrationIntake(page, {
    fullName: "Intake Persist Guest",
    nationalId,
    fatherName,
    birthDate,
    partySize: "1",
    registrantTarget: "self",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });

  await gotoMemberProfile(page);
  await expect(page.locator('[data-member-profile-field="nationalId"] input')).toHaveValue(
    nationalId
  );
  await expect(page.locator('[data-member-profile-field="fatherName"] input')).toHaveValue(
    fatherName
  );
  await expect(page.locator('[data-member-profile-field="birthDate"] input')).toHaveValue(
    birthDate
  );
});
