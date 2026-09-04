/**
 * WALLET-P3C — Denali club exposes Wallet when tenant theme enables module.
 */
import { expect, test } from "@playwright/test";

const DENALI_ADMIN_BASE =
  process.env.SMOKE_DENALI_WEB_BASE_URL ?? "http://denali.admin.localhost:3000";
const DENALI_OWNER_MOBILE = "09174070937";
const DEV_OTP = "1234";

test.use({ baseURL: DENALI_ADMIN_BASE });

async function loginDenaliOwner(page: import("@playwright/test").Page): Promise<void> {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: DENALI_OWNER_MOBILE },
    timeout: 120_000,
  });
  expect(otpRes.ok()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: DENALI_OWNER_MOBILE,
      otp: DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  expect(loginRes.ok()).toBeTruthy();
}

test("WALLET-CERT-D01 Denali club has wallet nav and /wallet loads", async ({ page }) => {
  await loginDenaliOwner(page);
  await page.goto("/");
  await expect(page.locator("[data-operator-nav]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-operator-nav-link][href="/wallet"]')).toBeVisible();
  const walletResponse = await page.goto("/wallet");
  expect(walletResponse?.status()).toBe(200);
});
