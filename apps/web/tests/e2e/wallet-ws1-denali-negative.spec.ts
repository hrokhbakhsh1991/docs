/**
 * WALLET-P3C — Denali must remain without Wallet surfaces.
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

test("WALLET-CERT-D01 Denali has no wallet nav and /wallet is 404", async ({ page }) => {
  await loginDenaliOwner(page);
  await page.goto("/");
  await expect(page.locator("[data-operator-nav]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-operator-nav-link][href="/wallet"]')).toHaveCount(0);
  const walletResponse = await page.goto("/wallet");
  expect(walletResponse?.status()).toBe(404);
});
