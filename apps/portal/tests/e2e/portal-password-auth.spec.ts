import { expect, test } from "@playwright/test";

import { fillRegistrationPhone } from "./fixtures/catalog-registration-otp";
import { completePortalCatalogRegistration } from "./fixtures/complete-portal-registration";
import { gotoMemberProfile } from "./fixtures/portal-member-profile";

// These are disposable memory-driver fixtures, not credentials for any real account.
const phone = `+1555${String(Date.now()).slice(-7)}`;
const password = "Test-only aurora valley 9472";

test("member creates a password with OTP and signs in again", async ({ page }) => {
  await completePortalCatalogRegistration(page, {
    email: "password-auth@example.test",
    fullName: "Password browser test",
    phone,
  });
  await gotoMemberProfile(page);
  const settings = page.locator("[data-account-password-settings]");
  await expect(settings.getByRole("button", { name: "ایجاد رمز عبور" })).toBeVisible({
    timeout: 90_000,
  });
  await settings.getByRole("button", { name: "ایجاد رمز عبور" }).click();
  await settings.getByLabel("کد پیامکی").fill("1234");
  await settings.getByLabel("رمز عبور جدید").fill(password);
  await settings.getByLabel("تکرار رمز عبور").fill(password);
  await settings.getByRole("button", { name: "ذخیره رمز" }).click();
  await expect(settings.getByRole("status")).toContainText("رمز ذخیره شد", { timeout: 90_000 });

  await page.context().clearCookies();
  await page.goto("/login?portalReturn=%2Fme%2Fregistrations", { waitUntil: "domcontentloaded" });
  await fillRegistrationPhone(page, phone);
  await page.locator('[data-action="password-login"]').click({ timeout: 90_000 });
  const form = page.locator("[data-public-registration-password]");
  await form.getByLabel("رمز عبور", { exact: true }).fill("wrong-test-password");
  await form.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("رمز عبور درست نیست", { timeout: 90_000 });
  await form.getByLabel("رمز عبور", { exact: true }).fill(password);
  await form.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 90_000 });
});
