/**
 * WALLET-P3C — member portal certification login helpers.
 */
import { expect, type Page } from "@playwright/test";

import { WALLET_WS1_CERTIFICATION } from "../../../../api/test/fixtures/wallet-ws1-certification-tenant";

export const WALLET_WS1_PORTAL_BASE_URL =
  process.env.SMOKE_PORTAL_BASE_URL ?? "http://portal.wallet-ws1.localhost:3003";

export const WALLET_WS1_MEMBER_WALLET_PATH = "/me/wallet" as const;

const SESSION_COOKIE = "atour_mb_session";

export async function loginWalletWs1Member(
  page: Page,
  phone: string = WALLET_WS1_CERTIFICATION.entitledMemberMobile
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
      otp: WALLET_WS1_CERTIFICATION.devOtp,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  const verifyText = await verifyRes.text();
  expect(verifyRes.ok(), verifyText).toBeTruthy();
  const verifyBody = JSON.parse(verifyText) as { session_token?: string };
  expect(typeof verifyBody.session_token).toBe("string");

  const cookieDomain = "portal.wallet-ws1.localhost";
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: verifyBody.session_token!,
      domain: cookieDomain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}
