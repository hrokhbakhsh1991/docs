import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";
import { OPERATOR_SMOKE_PARTICIPANT_TOUR_ID } from "./fixtures/complete-portal-registration";
import { pickIntakeBirthDate } from "./fixtures/intake-birth-date-picker";
import { openRegistrationIntakeForAuthenticatedMember } from "./fixtures/portal-member-profile";

const SMOKE_MEMBER_PHONE = "+15550001003";
const SELF_BIRTH_DATE = "1990-05-20";
const COMPANION_BIRTH_DATE = "1992-03-20";

async function reachParticipantIntake(page: import("@playwright/test").Page, phone: string) {
  await page.context().clearCookies();
  await gotoPortalRegistration(page, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 120_000 });
  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Jalali Intake Guest");
    await page.locator('[data-action="profile-continue"]').click();
  }
  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 120_000,
  });
}

async function resumeIntakeWithSession(page: import("@playwright/test").Page) {
  await page.context().clearCookies();
  await gotoPortalRegistration(page, OPERATOR_SMOKE_PARTICIPANT_TOUR_ID);
  await requestRegistrationOtp(page, SMOKE_MEMBER_PHONE);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(page.locator('[data-registration-resume="intake"]')).toBeVisible({
    timeout: 120_000,
  });
  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 120_000,
  });
}

test.describe("portal Jalali intake birth date", () => {
  test("DEN-INTAKE-CAL-01 self birthDate POST body is Gregorian YYYY-MM-DD", async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await reachParticipantIntake(page, phone);
    const selfCard = page.locator("[data-denali-self-guest-card]");
    await selfCard.locator('[data-intake-field="fullName"]').fill("Self Jalali Guest");
    await selfCard.locator('[data-intake-field="nationalId"]').fill("1234567890");
    await selfCard.locator('[data-intake-field="fatherName"]').fill("Self Father");
    await pickIntakeBirthDate(page, selfCard, SELF_BIRTH_DATE);

    const requestPromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes("/api/catalog/registrations") &&
        req.postData()?.includes(`"birthDate":"${SELF_BIRTH_DATE}"`) === true,
      { timeout: 90_000 }
    );
    await page.locator('[data-action="intake-submit"]').click();
    const request = await requestPromise;
    expect(request.postData() ?? "").toContain(`"birthDate":"${SELF_BIRTH_DATE}"`);
  });

  test("DEN-INTAKE-CAL-02 companion birthDate POST body is Gregorian YYYY-MM-DD", async ({
    page,
  }) => {
    const phone = `+1555${String(Date.now() + 1).slice(-7)}`;
    await reachParticipantIntake(page, phone);
    await page.locator("[data-denali-registrant-self-toggle] input").click();
    await expect(page.locator("[data-denali-self-guest-card]")).toHaveCount(0);
    await page.locator("[data-denali-add-guest]").first().click();
    const guestCard = page.locator("[data-denali-other-guest-card]").first();
    await guestCard.locator('[data-intake-field="fullName"]').fill("Companion Guest");
    await guestCard.locator('[data-intake-field="phone"]').fill(phone);
    await guestCard.locator('[data-intake-field="nationalId"]').fill("2234567890");
    await guestCard.locator('[data-intake-field="fatherName"]').fill("Companion Father");
    await pickIntakeBirthDate(page, guestCard, COMPANION_BIRTH_DATE);

    const requestPromise = page.waitForRequest(
      (req) =>
        req.method() === "POST" &&
        req.url().includes("/api/catalog/registrations") &&
        req.postData()?.includes(`"birthDate":"${COMPANION_BIRTH_DATE}"`) === true,
      { timeout: 90_000 }
    );
    await page.locator('[data-action="intake-submit"]').click();
    const request = await requestPromise;
    expect(request.postData() ?? "").toContain(`"birthDate":"${COMPANION_BIRTH_DATE}"`);
  });

  test("DEN-INTAKE-CAL-03 required birthDate shows validation without Gregorian hint", async ({
    page,
  }) => {
    await resumeIntakeWithSession(page);
    await page.locator('[data-action="intake-submit"]').click();
    await expect(page.locator('[data-intake-field="birthDate"][aria-invalid="true"]')).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.locator("text=YYYY-MM-DD")).toHaveCount(0);
  });

  test("DEN-INTAKE-CAL-04 mobile picker stays above sticky CTA", async ({ page }) => {
    await openRegistrationIntakeForAuthenticatedMember(
      page,
      SMOKE_MEMBER_PHONE,
      OPERATOR_SMOKE_PARTICIPANT_TOUR_ID
    );
    const intakeRoot = page.locator("[data-public-registration-intake][data-registration-ready]");
    await page.setViewportSize({ width: 390, height: 844 });
    await intakeRoot.locator('[data-intake-field="birthDate"]').first().click();

    const popover = page.locator("[data-operator-wizard-calendar-popover]");
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute("data-operator-wizard-calendar-placement", "top");

    const cta = page.locator('[data-action="intake-submit"]').first();
    const popoverBox = await popover.boundingBox();
    const ctaBox = await cta.boundingBox();
    expect(popoverBox).not.toBeNull();
    expect(ctaBox).not.toBeNull();
    expect(popoverBox!.y + popoverBox!.height).toBeLessThanOrEqual(ctaBox!.y + 2);
  });
});
