/**
 * Phase 8.4 — owner dev session host for SMK-P8-03 / P15-W-D2.
 * @see docs/phase-8/appendices/SMOKE-SCENARIO-MAP.md
 */
import { expect, type Page } from "@playwright/test";

export const URBAN_OWNER_E2E_BASE_URL =
  process.env.SMOKE_OWNER_WEB_BASE_URL ?? "http://workspace-owner-smoke.localhost:3000";

export const URBAN_OWNER_SETTINGS_PATH = "/settings/workspace-owner" as const;

/** Sync with API `URBAN_SMOKE_E2E` identity seed when `URBAN_SMOKE_E2E_SEED=1`. */
export const URBAN_OWNER_MOBILE = "+15550004001";
export const URBAN_DEV_OTP = "1234";

export async function loginUrbanOwner(page: Page): Promise<void> {
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: URBAN_OWNER_MOBILE },
    timeout: 120_000,
  });
  expect(otpRes.ok()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: URBAN_OWNER_MOBILE,
      otp: URBAN_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  expect(loginRes.ok()).toBeTruthy();
}
