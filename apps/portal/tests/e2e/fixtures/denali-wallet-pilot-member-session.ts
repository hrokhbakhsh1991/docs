/**
 * Phase 2 — Denali Wallet pilot portal login helpers.
 */
import { expect, type Page } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../../api/test/fixtures/denali-wallet-pilot-tenant";

export const DENALI_WALLET_PILOT_PORTAL_BASE_URL =
  process.env.SMOKE_DENALI_WALLET_PILOT_PORTAL_BASE_URL ??
  "http://portal.denali-wallet-pilot.localhost:3003";

export const DENALI_WALLET_PILOT_MEMBER_WALLET_PATH = "/me/wallet" as const;

const SESSION_COOKIE = "atour_mb_session";

export async function loginDenaliWalletPilotMember(
  page: Page,
  phone: string = DENALI_WALLET_PILOT.entitledMemberMobile
): Promise<void> {
  await page.context().clearCookies();
  const otpRes = await page.request.post("/api/public-auth/request-otp", {
    data: { phone },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const verifyRes = await page.request.post("/api/public-auth/verify-otp", {
    data: {
      phone,
      otp: DENALI_WALLET_PILOT.devOtp,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  const verifyText = await verifyRes.text();
  expect(verifyRes.ok(), verifyText).toBeTruthy();
  const verifyBody = JSON.parse(verifyText) as { session_token?: string };
  expect(typeof verifyBody.session_token).toBe("string");

  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: verifyBody.session_token!,
      domain: "portal.denali-wallet-pilot.localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
