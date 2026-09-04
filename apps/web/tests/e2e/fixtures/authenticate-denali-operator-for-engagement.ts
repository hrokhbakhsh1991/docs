/**
 * MEG-001 — Denali operator engagement session helpers.
 */
import { expect, type Page } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../../src/auth/build-session-cookie";

export const DENALI_OPERATOR_OWNER_MOBILE = "09174070937";
export const DENALI_OPERATOR_VIEWER_MOBILE = "+15550001996";
export const DENALI_DEV_OTP = "1234";

async function loginDenaliOperatorSession(
  page: Page,
  phone: string,
  endpoint: "login-web-session" | "login-team-web-session" = "login-web-session",
): Promise<void> {
  await page.context().clearCookies();

  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post(`/api/auth/${endpoint}`, {
    data: {
      phone,
      otp: DENALI_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  const loginText = await loginRes.text();
  expect(loginRes.ok(), loginText).toBeTruthy();
  const loginBody = JSON.parse(loginText) as { session_token?: string };
  expect(typeof loginBody.session_token).toBe("string");

  const context = page.context() as {
    readonly _options?: { readonly baseURL?: string };
  };
  const baseURL = context._options?.baseURL?.trim() ?? "http://denali.admin.localhost:3000";
  const cookieUrl = baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;

  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      url: cookieUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

export async function loginDenaliOperatorOwner(page: Page): Promise<void> {
  await loginDenaliOperatorSession(page, DENALI_OPERATOR_OWNER_MOBILE);
}

export async function loginDenaliOperatorViewer(page: Page): Promise<void> {
  await loginDenaliOperatorSession(page, DENALI_OPERATOR_VIEWER_MOBILE, "login-team-web-session");
}
