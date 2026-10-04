/**
 * Phase 2 — Denali Wallet pilot operator web login helpers.
 */
import { expect, type Page } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../../api/test/fixtures/denali-wallet-pilot-tenant";

export const DENALI_WALLET_PILOT_OPERATOR_BASE_URL =
  process.env.SMOKE_DENALI_WALLET_PILOT_WEB_BASE_URL ??
  "http://admin.denali-wallet-pilot.localhost:3000";

export const DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH = "/wallet" as const;
const WALLET_AUTH_TIMEOUT_MS = 300_000;

export async function loginDenaliWalletPilotOwner(page: Page): Promise<void> {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: DENALI_WALLET_PILOT.ownerMobile },
    timeout: WALLET_AUTH_TIMEOUT_MS,
  });
  expect(otpRes.ok()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: DENALI_WALLET_PILOT.ownerMobile,
      otp: DENALI_WALLET_PILOT.devOtp,
      challenge_id: otpBody.challenge_id,
    },
    timeout: WALLET_AUTH_TIMEOUT_MS,
  });
  expect(loginRes.ok()).toBeTruthy();
}
