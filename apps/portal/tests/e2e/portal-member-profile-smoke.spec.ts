import { expect, test } from "@playwright/test";

import {
  completePortalCatalogRegistration,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
} from "./fixtures/complete-portal-registration";
import {
  DENALI_PROFILE_BIRTH_DATE,
  DENALI_PROFILE_BIRTH_DATE_LABEL_FA,
  DENALI_PROFILE_FATHER_NAME,
  DENALI_PROFILE_NATIONAL_ID,
  gotoMemberProfile,
  openRegistrationIntakeForAuthenticatedMember,
  saveMemberProfileFields,
} from "./fixtures/portal-member-profile";
import { pickProfileBirthDate } from "./fixtures/profile-birth-date-picker";

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
  await expect(
    page.locator(
      '[data-member-profile-field="birthDate"] [data-testid="member-profile-birth-date-picker"]'
    )
  ).toBeVisible();
  await expect(page.locator('[data-member-profile-field="gender"] select')).toBeVisible();
  await expect(page.locator("[data-member-profile-mobile-change]")).toBeVisible();
  await expect(page.locator("[data-member-profile-save]")).toBeVisible();
});

test("DEN-PROF-04 mobile change via OTP updates profile mobile", async ({ page }) => {
  const newMobile = `+1555${String(Date.now()).slice(-7)}`;
  const normalizedMobile = newMobile.replace(/\D/g, "");

  await gotoMemberProfile(page);
  await page.locator("[data-member-profile-mobile-change-start]").click();
  await page.locator("#profile-mobile-change-phone").fill(normalizedMobile);

  const [requestResponse] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/me/mobile/request-otp"),
      { timeout: 90_000 }
    ),
    page.locator('[data-member-profile-mobile-change-request] button').first().click(),
  ]);
  expect(requestResponse.ok()).toBeTruthy();

  const requestResult = await page.request.post("/api/me/mobile/request-otp", {
    data: { phone: normalizedMobile },
  });
  expect(requestResult.ok()).toBeTruthy();
  const requestBody = (await requestResult.json()) as { challenge_id?: string };
  expect(requestBody.challenge_id).toBeTruthy();
  const challengeId = requestBody.challenge_id!;

  async function verifyMobileChange(): Promise<void> {
    const verifyStep = page.locator("[data-member-profile-mobile-change-verify]");
    if (await verifyStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
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
      return;
    }

    const verifyResult = await page.request.post("/api/me/mobile/verify", {
      data: {
        phone: normalizedMobile,
        otp: "1234",
        challenge_id: challengeId,
      },
    });
    expect(
      verifyResult.ok(),
      `mobile verify fallback failed (${verifyResult.status()})`
    ).toBeTruthy();
  }

  await verifyMobileChange();

  await page.goto("/me/profile", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main[data-portal-member-profile]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-member-profile-mobile-change-value]")).toContainText(
    normalizedMobile.slice(-4),
    { timeout: 60_000 }
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
  await expect(page.locator('[data-testid="member-profile-birth-date-picker"]')).toContainText(
    DENALI_PROFILE_BIRTH_DATE_LABEL_FA
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

function readPatchBirthDate(postData: string | null): string | null | undefined {
  if (postData == null) {
    return undefined;
  }
  const body = JSON.parse(postData) as { fields?: { birthDate?: string | null } };
  return body.fields?.birthDate;
}

test("DEN-PROF-06 seeded birth date survives open/save without edit", async ({ page }) => {
  await gotoMemberProfile(page);
  await saveMemberProfileFields(page, {
    birthDate: DENALI_PROFILE_BIRTH_DATE,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await gotoMemberProfile(page);

  const birthField = page.locator('[data-member-profile-field="birthDate"]');
  const picker = birthField.locator('[data-testid="member-profile-birth-date-picker"]');
  await expect(picker).toContainText(DENALI_PROFILE_BIRTH_DATE_LABEL_FA);

  await picker.click();
  const popover = page.locator("[data-operator-wizard-calendar-popover]");
  await expect(popover).toBeVisible();
  await expect(
    popover.locator(`button[aria-label="${DENALI_PROFILE_BIRTH_DATE}"][aria-pressed="true"]`)
  ).toBeVisible();
  await page.locator("body").click({ position: { x: 8, y: 8 } });
  await expect(popover).toBeHidden({ timeout: 10_000 });

  const patchAfterSave = await page
    .waitForRequest(
      (req) => req.method() === "PATCH" && req.url().includes("/api/me/profile"),
      { timeout: 8_000 }
    )
    .catch(() => null);

  if (patchAfterSave !== null) {
    expect(readPatchBirthDate(patchAfterSave.postData())).toBe(DENALI_PROFILE_BIRTH_DATE);
  } else {
    const profileRes = await page.request.get("/api/me/profile");
    expect(profileRes.ok()).toBeTruthy();
    const profileBody = (await profileRes.json()) as {
      profile?: { fields?: { birthDate?: string | null } };
    };
    expect(profileBody.profile?.fields?.birthDate).toBe(DENALI_PROFILE_BIRTH_DATE);
  }
});

test("DEN-PROF-07 clear birth date to null and re-select via Jalali picker", async ({ page }) => {
  await gotoMemberProfile(page);
  await saveMemberProfileFields(page, {
    birthDate: DENALI_PROFILE_BIRTH_DATE,
  });

  const birthField = page.locator('[data-member-profile-field="birthDate"]');
  const picker = birthField.locator('[data-testid="member-profile-birth-date-picker"]');
  const clearButton = birthField.locator("[data-member-profile-birth-date-clear]");

  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(clearButton).toBeHidden();

  const clearedPatch = await Promise.all([
    page.waitForRequest(
      (req) =>
        req.method() === "PATCH" &&
        req.url().includes("/api/me/profile") &&
        readPatchBirthDate(req.postData()) === null,
      { timeout: 90_000 }
    ),
    page.locator("[data-member-profile-save]").click(),
  ]).then(([request]) => request);
  expect(readPatchBirthDate(clearedPatch.postData())).toBeNull();

  await pickProfileBirthDate(page, birthField, DENALI_PROFILE_BIRTH_DATE);
  await expect(picker).toContainText(DENALI_PROFILE_BIRTH_DATE_LABEL_FA);

  const selectedPatch = await Promise.all([
    page.waitForRequest(
      (req) =>
        req.method() === "PATCH" &&
        req.url().includes("/api/me/profile") &&
        readPatchBirthDate(req.postData()) === DENALI_PROFILE_BIRTH_DATE,
      { timeout: 90_000 }
    ),
    page.locator("[data-member-profile-save]").click(),
  ]).then(([request]) => request);
  expect(readPatchBirthDate(selectedPatch.postData())).toBe(DENALI_PROFILE_BIRTH_DATE);
});
