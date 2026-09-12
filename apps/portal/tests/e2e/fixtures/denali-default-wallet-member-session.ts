/**
 * Denali default club portal login helpers (tenant …000003).
 */
import { expect, type Page } from "@playwright/test";

import { DENALI_DEFAULT_WALLET } from "../../../../api/test/fixtures/denali-default-wallet-tenant";

export const DENALI_DEFAULT_WALLET_PORTAL_BASE_URL =
  process.env.SMOKE_DENALI_DEFAULT_WALLET_PORTAL_BASE_URL ??
  "http://portal.denali.localhost:3003";

const SESSION_COOKIE = "atour_mb_session";

export async function loginDenaliDefaultWalletMember(
  page: Page,
  phone: string = DENALI_DEFAULT_WALLET.entitledMemberMobile,
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
      otp: DENALI_DEFAULT_WALLET.devOtp,
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
      domain: "portal.denali.localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
