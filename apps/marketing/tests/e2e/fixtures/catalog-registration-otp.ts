import { expect, type FrameLocator, type Page } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

type RegistrationSurface = Pick<Page, "locator" | "getByLabel"> | FrameLocator;

/** Portal registration phone step — wait for client hydration before interacting. */
export async function fillCatalogPhone(
  surface: RegistrationSurface,
  phone: string
): Promise<void> {
  const phoneStep = surface.locator(
    "[data-public-registration-phone][data-registration-ready]"
  );
  await phoneStep.waitFor({ state: "visible", timeout: 60_000 });
  const input = phoneStep.locator("#phone");
  await input.click();
  await input.fill("");
  await input.pressSequentially(phone, { delay: 15 });
  await expect(input).not.toHaveValue("");
}

export async function submitCatalogPhoneForOtp(
  page: Page,
  phone: string,
  surface: RegistrationSurface = page
): Promise<void> {
  await fillCatalogPhone(surface, phone);
  const sendCode = surface.locator('[data-action="send-code"]');
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
  await expect(surface.locator("[data-public-registration-otp]")).toBeVisible({
    timeout: 60_000,
  });
}

export async function fillCatalogOtp(
  page: Page,
  code: string,
  surface: RegistrationSurface = page
): Promise<void> {
  const otpStep = surface.locator("[data-public-registration-otp]");
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
  surface: RegistrationSurface,
  fieldId: string,
  value: string
): Promise<void> {
  const input = surface.locator(`[data-intake-field="${fieldId}"]`);
  if (await input.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await input.fill(value);
  }
}

export async function completeCatalogRegistrationIntake(
  page: Page,
  surface: RegistrationSurface = page,
  input: {
    readonly email: string;
    readonly fullName: string;
    readonly partySize?: string;
    readonly nationalId?: string;
    readonly fatherName?: string;
    readonly birthDate?: string;
  }
): Promise<void> {
  const profileStep = surface.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await surface.locator("#displayName").fill(input.fullName);
    await surface.locator('[data-action="profile-continue"]').click();
  }

  await surface.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 60_000,
  });

  await fillIntakeFieldIfVisible(surface, "fullName", input.fullName);
  await fillIntakeFieldIfVisible(surface, "email", input.email);
  await fillIntakeFieldIfVisible(surface, "nationalId", input.nationalId ?? "1234567890");
  await fillIntakeFieldIfVisible(surface, "fatherName", input.fatherName ?? "Smoke Father");
  await fillIntakeFieldIfVisible(surface, "birthDate", input.birthDate ?? "1990-01-15");
  await fillIntakeFieldIfVisible(surface, "partySize", input.partySize ?? "2");

  const partySizeInput = surface.getByLabel(/Party size|تعداد نفرات/);
  if (await partySizeInput.isVisible({ timeout: 500 }).catch(() => false)) {
    await partySizeInput.fill(input.partySize ?? "2");
  }

  const transportFieldset = surface.locator("[data-public-registration-transport]");
  if (await transportFieldset.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await surface.locator('input[name="hasPersonalCar"]').nth(1).click();
    await surface.locator('input[name="paysDong"]').first().click();
  }

  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" &&
        res.url().includes("/api/catalog/registrations"),
      { timeout: 90_000 }
    ),
    surface.locator('[data-action="intake-submit"]').click(),
  ]);
  const body = await response.text();
  expect(
    response.ok(),
    `catalog registration failed (${response.status()}): ${body.slice(0, 240)}`
  ).toBeTruthy();
}
