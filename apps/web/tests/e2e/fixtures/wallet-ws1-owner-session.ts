/**
 * WALLET-P3C — operator web certification login helpers.
 */
import { expect, type Page } from "@playwright/test";

import { WALLET_WS1_CERTIFICATION } from "../../../../api/test/fixtures/wallet-ws1-certification-tenant";

export const WALLET_WS1_OPERATOR_BASE_URL =
  process.env.SMOKE_OWNER_WEB_BASE_URL ?? "http://admin.wallet-ws1.localhost:3000";

export const WALLET_WS1_OPERATOR_WALLET_PATH = "/wallet" as const;

export async function loginWalletWs1Owner(page: Page): Promise<void> {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: WALLET_WS1_CERTIFICATION.ownerMobile },
    timeout: 120_000,
  });
  expect(otpRes.ok()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: WALLET_WS1_CERTIFICATION.ownerMobile,
      otp: WALLET_WS1_CERTIFICATION.devOtp,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  expect(loginRes.ok()).toBeTruthy();
}
