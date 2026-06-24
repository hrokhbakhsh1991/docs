import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

export async function gotoPortalRegistration(page: Page, tourId: string): Promise<void> {
  await page.goto(`/catalog/${tourId}/register`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
    timeout: 120_000,
  });
}

export async function fillCatalogOtp(page: Page, code: string): Promise<void> {
  const digits = code.split("");
  for (let index = 0; index < digits.length; index += 1) {
    await page.locator(`[data-otp-cell="${index}"]`).fill(digits[index] ?? "");
  }
}

/** Reliable phone entry for portal LocalizedNumericInput (fa locale). */
export async function fillRegistrationPhone(page: Page, phone: string): Promise<void> {
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

/** Send OTP and assert portal BFF request-otp succeeds before UI advances. */
export async function requestRegistrationOtp(page: Page, phone: string): Promise<void> {
  await fillRegistrationPhone(page, phone);
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

export async function completeCatalogRegistrationIntake(
  page: Page,
  input: { readonly email: string; readonly fullName: string; readonly partySize?: string }
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

  await page.locator('input[name="email"]').fill(input.email);
  await page.locator('input[name="fullName"]').fill(input.fullName);
  await page.getByLabel(/Party size|تعداد نفرات/).fill(input.partySize ?? "2");
  await page.locator('[data-action="intake-submit"]').click();
}
