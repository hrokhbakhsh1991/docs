import { expect, type Page } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

/** Portal registration phone step — wait for client hydration before interacting. */
export async function fillCatalogPhone(page: Page, phone: string): Promise<void> {
  const phoneStep = page.locator(
    "[data-public-registration-phone][data-registration-ready]"
  );
  await phoneStep.waitFor({ state: "visible", timeout: 60_000 });
  const input = phoneStep.locator("#phone");
  await input.click();
  await input.fill("");
  await input.pressSequentially(phone, { delay: 15 });
  await expect(input).not.toHaveValue("");
}

export async function submitCatalogPhoneForOtp(page: Page, phone: string): Promise<void> {
  await fillCatalogPhone(page, phone);
  const sendCode = page.locator('[data-action="send-code"]');
  await expect(sendCode).toBeEnabled({ timeout: 15_000 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/public-auth/request-otp"),
      { timeout: 90_000 }
    ),
    sendCode.click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `request-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
  await expect(page.locator("[data-public-registration-otp]")).toBeVisible({
    timeout: 60_000,
  });
}

export async function fillCatalogOtp(page: Page, code: string): Promise<void> {
  const otpStep = page.locator("[data-public-registration-otp]");
  await otpStep.waitFor({ state: "visible", timeout: 60_000 });
  const input = otpStep.locator("#otp");
  await input.click();
  await input.fill("");
  await input.pressSequentially(code.replace(/\D/g, ""), { delay: 15 });

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/public-auth/verify-otp"),
      { timeout: 90_000 }
    ),
    page.locator('[data-action="verify-otp"]').click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `verify-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}

/** Reliable phone entry for portal LocalizedNumericInput (fa locale). */
export async function fillRegistrationPhone(page: Page, phone: string): Promise<void> {
  const input = page.locator("[data-public-registration-phone] input").first();
  await input.click();
  await input.fill("");
  await input.pressSequentially(phone, { delay: 15 });
  await expect(input).not.toHaveValue("");
}

/** Send OTP and assert portal BFF request-otp succeeds before UI advances. */
export async function requestRegistrationOtp(page: Page, phone: string): Promise<void> {
  await fillRegistrationPhone(page, phone);
  const sendCode = page.locator('[data-action="send-code"]');
  await expect(sendCode).toBeEnabled({ timeout: 15_000 });

  const otpResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/public-auth/request-otp") &&
      response.request().method() === "POST",
    { timeout: 90_000 }
  );
  await sendCode.click();
  const response = await otpResponse;
  const body = await response.text();
  expect(
    response.ok(),
    `request-otp failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}

async function fillIntakeFieldIfVisible(
  page: Page,
  fieldId: string,
  value: string
): Promise<void> {
  const input = page.locator(`[data-intake-field="${fieldId}"]`);
  if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await input.fill(value);
  }
}

export async function completeCatalogRegistrationIntake(
  page: Page,
  input: {
    readonly email: string;
    readonly fullName: string;
    readonly partySize?: string;
    readonly nationalId?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
  }
): Promise<void> {
  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(input.fullName);
    await page.locator('[data-action="profile-continue"]').click();
  }

  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 60_000,
  });

  await fillIntakeFieldIfVisible(page, "fullName", input.fullName);
  await fillIntakeFieldIfVisible(page, "email", input.email);
  await fillIntakeFieldIfVisible(page, "nationalId", input.nationalId ?? "1234567890");
  await fillIntakeFieldIfVisible(page, "fatherName", input.fatherName ?? "Smoke Father");
  await fillIntakeFieldIfVisible(page, "birthDate", input.birthDate ?? "1990-01-15");
  await fillIntakeFieldIfVisible(page, "partySize", input.partySize ?? "2");

  const partySizeInput = page.getByLabel(/Party size|تعداد نفرات/);
  if (await partySizeInput.isVisible({ timeout: 500 }).catch(() => false)) {
    await partySizeInput.fill(input.partySize ?? "2");
  }

  const transportFieldset = page.locator("[data-public-registration-transport]");
  if (await transportFieldset.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.locator('input[name="hasPersonalCar"]').nth(1).click();
    await page.locator('input[name="paysDong"]').first().click();
  }

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/catalog/registrations"),
      { timeout: 90_000 }
    ),
    page.locator('[data-action="intake-submit"]').click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `catalog registration failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}
