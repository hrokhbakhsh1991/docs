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
  phone: string = DENALI_WALLET_PILOT.entitledMemberMobile,
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
  const verifyBody = JSON.parse(verifyText) as {
    session_token?: string;
    requires_registration?: boolean;
    onboarding_token?: string;
  };

  let sessionToken = verifyBody.session_token;
  if (verifyBody.requires_registration === true) {
    expect(typeof verifyBody.onboarding_token).toBe("string");
    const completeRes = await page.request.post("/api/public-auth/register-complete", {
      data: {
        onboarding_token: verifyBody.onboarding_token,
        display_name: "Wallet Pilot Member",
      },
      timeout: 120_000,
    });
    const completeText = await completeRes.text();
    expect(completeRes.ok(), completeText).toBeTruthy();
    const completeBody = JSON.parse(completeText) as { session_token?: string };
    sessionToken = completeBody.session_token;
  }

  expect(typeof sessionToken).toBe("string");

  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: sessionToken!,
      domain: "portal.denali-wallet-pilot.localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  const probe = await page.request.get("/api/me/notifications/unread-count");
  expect(probe.ok(), await probe.text()).toBeTruthy();
}
