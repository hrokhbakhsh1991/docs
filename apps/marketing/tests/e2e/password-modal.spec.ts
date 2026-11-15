import { expect, test } from "@playwright/test";
import { fillCatalogPhone } from "./fixtures/catalog-registration-otp";

const portal = process.env.SESSION_SYNC_PORTAL_URL ?? "http://portal.denali.localhost:3004";
const phone = process.env.SESSION_SYNC_PHONE ?? "+15550001996";
const otp = process.env.SESSION_SYNC_OTP ?? "1234";
const tour = process.env.SESSION_SYNC_TOUR_ID ?? "00000000-0000-4000-8000-000000000220";
const password = "Test-only cobalt river 2738";

test("tour modal signs an existing member in with a password", async ({ page, context }) => {
  // Provision a disposable member password via the actual OTP-protected portal UI.
  await page.goto(`${portal}/login?portalReturn=%2Fme%2Fprofile`);
  await page.getByLabel("موبایل").fill(phone);
  await page.getByRole("button", { name: "ارسال کد" }).click();
  const otpBox = page.getByRole("group", { name: "کد یک‌بارمصرف" });
  await expect(otpBox).toBeVisible({ timeout: 60_000 });
  await otpBox.getByRole("textbox").first().fill(otp);
  await expect(page).toHaveURL(/\/me\/profile/, { timeout: 90_000 });
  const settings = page.locator("[data-account-password-settings]");
  await settings.getByRole("button", { name: "ایجاد رمز عبور" }).click({ timeout: 90_000 });
  await settings.getByLabel("کد پیامکی").fill(otp);
  await settings.getByLabel("رمز عبور جدید").fill(password);
  await settings.getByLabel("تکرار رمز عبور").fill(password);
  await settings.getByRole("button", { name: "ذخیره رمز" }).click();
  await expect(settings.getByRole("status")).toContainText("رمز ذخیره شد", { timeout: 90_000 });

  await context.clearCookies();
  await page.goto(`/tours/${tour}`);
  const cta = page.locator(
    "[data-marketing-catalog-detail-booking-rail-cta] [data-marketing-register][data-marketing-register-ready='true']"
  );
  await expect(cta).toBeVisible({ timeout: 90_000 });
  await cta.click();
  const phoneStep = page.locator("[data-public-registration-phone][data-registration-ready]");
  await fillCatalogPhone(page, phone);
  await phoneStep.locator('[data-action="password-login"]').click({ timeout: 90_000 });
  const form = page.locator("[data-public-registration-password]");
  await form.getByLabel("رمز عبور", { exact: true }).fill(password);
  await form.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).toHaveURL(/\/catalog\/[^/]+\/register/, { timeout: 90_000 });
  const header = await context.newPage();
  await header.goto("/");
  await expect(header.locator("[data-marketing-member-authenticated]")).toBeVisible({
    timeout: 30_000,
  });
});
