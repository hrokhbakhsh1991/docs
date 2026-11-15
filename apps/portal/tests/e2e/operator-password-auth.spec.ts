import { expect, test } from "@playwright/test";

// Only the isolated operator smoke fixture is used by this test.
const adminOrigin = "http://admin.operator.localhost:3000";
const ownerPhone = "+15550001001";
const password = "Test-only velvet canyon 4589";

test("workspace owner creates a password and logs in with it", async ({ page }) => {
  await page.goto(`${adminOrigin}/auth/login`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("operator-login-hydrated")).toBeAttached({ timeout: 90_000 });
  await page.locator("#phone").fill(ownerPhone);
  const [otpResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" && response.url().includes("/api/auth/request-otp"),
      { timeout: 90_000 }
    ),
    page.getByRole("button", { name: "ارسال رمز" }).click(),
  ]);
  expect(otpResponse.ok(), `operator OTP request failed (${otpResponse.status()})`).toBeTruthy();
  const digits = page.locator("[data-otp-segment-input] [data-otp-cell]");
  await expect(digits).toHaveCount(4, { timeout: 90_000 });
  for (const [index, digit] of Array.from("1234").entries()) {
    await digits.nth(index).fill(digit);
  }
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 90_000 });

  await page.goto(`${adminOrigin}/settings/me`, { waitUntil: "domcontentloaded" });
  const settings = page.locator("[data-account-password-settings]");
  const changePassword = settings.getByRole("button", { name: /ایجاد رمز عبور|تغییر رمز عبور/ });
  await expect(changePassword).toBeVisible({
    timeout: 90_000,
  });
  await changePassword.click();
  await settings.getByLabel("کد پیامکی").fill("1234");
  await settings.getByLabel("رمز عبور جدید").fill(password);
  await settings.getByLabel("تکرار رمز عبور").fill(password);
  await settings.getByRole("button", { name: "ذخیره رمز" }).click();
  await expect(settings.getByRole("status")).toContainText("رمز ذخیره شد", { timeout: 90_000 });

  await page.context().clearCookies();
  await page.goto(`${adminOrigin}/auth/login`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("operator-login-hydrated")).toBeAttached({ timeout: 90_000 });
  await page.locator("#phone").fill(ownerPhone);
  await page.getByRole("button", { name: "ورود با رمز عبور" }).click();
  await page.locator("#operator-password").fill("wrong-test-password");
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page.locator('form p[role="alert"]')).toContainText("رمز عبور درست نیست", {
    timeout: 90_000,
  });
  await page.locator("#operator-password").fill(password);
  await page.getByRole("button", { name: "ورود", exact: true }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 90_000 });
});
