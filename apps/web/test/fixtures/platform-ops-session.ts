/**
 * P1 EPIC H — Platform ops Playwright session (BFF login on admin host).
 */
import { expect, type Page } from "@playwright/test";

export const PLATFORM_OPS_PHONE = "+989121234567";
export const PLATFORM_DEV_OTP = "1234";

export async function loginPlatformOps(page: Page): Promise<void> {
  const otpRes = await page.request.post("/api/platform/auth/request-otp", {
    data: { phone: PLATFORM_OPS_PHONE },
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string; challengeId?: string };
  const challengeId = otpBody.challenge_id ?? otpBody.challengeId;
  expect(typeof challengeId).toBe("string");

  const loginRes = await page.request.post("/api/platform/auth/login", {
    data: {
      phone: PLATFORM_OPS_PHONE,
      otp: PLATFORM_DEV_OTP,
      challenge_id: challengeId,
    },
  });
  expect(loginRes.ok()).toBeTruthy();
  const loginBody = (await loginRes.json()) as { role?: string };
  expect(typeof loginBody.role).toBe("string");

  const workspacesRes = await page.request.get("/api/platform/workspaces");
  expect(workspacesRes.ok()).toBeTruthy();
}

export function uniquePlatformSubdomain(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).replace(/[^a-z0-9]/g, "")}`.slice(0, 40);
}
