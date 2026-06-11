import type { Page } from "@playwright/test";

export const CATALOG_DEV_OTP = "1234";

export async function fillCatalogOtp(page: Page, code: string): Promise<void> {
  const digits = code.split("");
  for (let index = 0; index < digits.length; index += 1) {
    await page.locator(`[data-otp-cell="${index}"]`).fill(digits[index] ?? "");
  }
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
