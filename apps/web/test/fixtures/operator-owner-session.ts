/**
 * Phase 9.8 — Playwright operator session helpers
 * Authority: docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 *
 * Uses BFF API login (not UI submit) so the `session` cookie is in Playwright
 * storage before `/api/users/*` client fetches (SMK-P9-03).
 */
import { expect, type Page } from "@playwright/test";

/** Sync with apps/api `.env.local` `OPERATOR_OWNER_MOBILE` (Denali dev owner). */
export const OPERATOR_OWNER_MOBILE = "+989121000001";
export const OPERATOR_ADMIN_MOBILE = "+15550001002";
export const OPERATOR_MEMBER_MOBILE = "+15550001003";
export const OPERATOR_MEMBER_DISPLAY_NAME = "Smoke Member";
export const OPERATOR_ADMIN_DISPLAY_NAME = "Smoke Admin";
export const OPERATOR_SMOKE_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000102";
export const OPERATOR_DEV_OTP = "1234";
export const OPERATOR_INVITEE_MOBILE = "+15550008803";

async function loginOperatorSessionViaBff(
  page: Page,
  phone: string
): Promise<void> {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone },
  });
  expect(otpRes.ok()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone,
      otp: OPERATOR_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
  });
  expect(loginRes.ok()).toBeTruthy();

  const abilityRes = await page.request.get("/api/auth/membership-ability-context");
  expect(abilityRes.ok()).toBeTruthy();
}

export async function loginOperatorWithPhone(
  page: Page,
  phone: string,
  options?: { readonly inviteToken?: string; readonly skipDashboard?: boolean }
): Promise<void> {
  await loginOperatorSessionViaBff(page, phone);

  if (options?.inviteToken !== undefined && options.inviteToken.length > 0) {
    const acceptRes = await page.request.post(
      `/api/auth/invite/${encodeURIComponent(options.inviteToken)}/accept`
    );
    expect(acceptRes.ok()).toBeTruthy();
  }

  if (options?.skipDashboard === true) {
    return;
  }

  await page.goto("/dashboard", { waitUntil: "domcontentloaded", timeout: 60_000 });
  await expect(page.getByTestId("operator-dashboard-grid")).toBeVisible({ timeout: 30_000 });
}

export async function loginOperatorOwner(page: Page): Promise<void> {
  await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE);
}
