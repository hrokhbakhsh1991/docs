import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import {
  OPERATOR_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_PARTICIPANT_TOUR_ID,
} from "./complete-portal-registration";

export const DENALI_PROFILE_NATIONAL_ID = "5544332210";
export const DENALI_PROFILE_FATHER_NAME = "Portal Profile Father";
export const DENALI_PROFILE_BIRTH_DATE = "1991-06-15";

export async function gotoMemberProfile(page: Page): Promise<void> {
  await page.goto("/me/profile", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main[data-portal-member-profile]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(
    page.locator('form[data-portal-member-profile][data-member-profile-ready="true"]')
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-member-profile-save]")).toBeEnabled({
    timeout: 60_000,
  });
}

export async function saveMemberProfileFields(
  page: Page,
  input: {
    readonly displayName?: string;
    readonly email?: string;
    readonly gender?: string;
    readonly nationalId?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
  }
): Promise<void> {
  async function fillProfileField(fieldId: string, value: string): Promise<void> {
    const field = page.locator(`[data-member-profile-field="${fieldId}"] input`);
    await field.click();
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }

  if (input.displayName !== undefined) {
    await fillProfileField("displayName", input.displayName);
  }
  if (input.email !== undefined) {
    await fillProfileField("email", input.email);
  }
  if (input.gender !== undefined) {
    const select = page.locator('[data-member-profile-field="gender"] select');
    await select.selectOption(input.gender);
    await expect(select).toHaveValue(input.gender);
  }
  if (input.nationalId !== undefined) {
    await fillProfileField("nationalId", input.nationalId);
  }
  if (input.fatherName !== undefined) {
    await fillProfileField("fatherName", input.fatherName);
  }
  if (input.birthDate !== undefined) {
    await fillProfileField("birthDate", input.birthDate);
  }

  const saveButton = page.locator(
    'form[data-portal-member-profile][data-member-profile-ready="true"] [data-member-profile-save]'
  );
  await expect(saveButton).toBeEnabled({ timeout: 15_000 });
  await saveButton.scrollIntoViewIfNeeded();

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "PATCH" && res.url().includes("/api/me/profile"),
      { timeout: 90_000 }
    ),
    saveButton.click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `profile PATCH failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
  await expect(page.getByRole("status")).toContainText(/saved|ذخیره/, {
    timeout: 15_000,
  });
}

export async function openRegistrationIntakeForAuthenticatedMember(
  page: Page,
  _phone: string,
  tourId: string = OPERATOR_PUBLISHED_TOUR_ID
): Promise<void> {
  await page.goto(`/catalog/${tourId}/register`, { waitUntil: "domcontentloaded" });
  await expect(page.locator('[data-registration-resume="intake"]').first()).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator("[data-public-registration-phone]")).toHaveCount(0);
  await expect(page.locator("[data-public-registration-otp]")).toHaveCount(0);
  await expect(page.locator("[data-public-registration-intake]")).toBeVisible({
    timeout: 60_000,
  });
}
