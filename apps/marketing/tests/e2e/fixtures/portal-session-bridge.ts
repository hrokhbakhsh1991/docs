import { expect, type BrowserContext, type Page } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
} from "./catalog-registration-otp";
import { resolveSmokePublishedTourId } from "./smoke-published-tour";

export const OPERATOR_SMOKE_MEMBER_PHONE = "+15550001003";

export function resolveMarketingBaseUrl(): string {
  return process.env.SMOKE_MARKETING_BASE_URL?.trim() || "http://operator.localhost:3002";
}

export function resolvePortalBaseUrl(): string {
  const marketing = new URL(resolveMarketingBaseUrl());
  if (marketing.hostname === "denali.localhost" || marketing.hostname === "denali.club") {
    return marketing.hostname === "denali.club"
      ? "http://portal.denali.club:3003"
      : "http://portal.denali.localhost:3003";
  }
  return "http://portal.operator.localhost:3003";
}

export function resolveSmokeTourId(): string {
  return resolveSmokePublishedTourId(resolveMarketingBaseUrl());
}

/** Portal-first OTP login — establishes shared atour_mb_session before marketing PDP. */
export async function authenticateMemberViaPortal(
  page: Page,
  input: { readonly phone?: string; readonly tourId?: string } = {}
): Promise<void> {
  const phone = input.phone ?? OPERATOR_SMOKE_MEMBER_PHONE;
  const tourId = input.tourId ?? resolveSmokeTourId();
  const portalBase = resolvePortalBaseUrl();

  const requestOtp = await page.request.post(`${portalBase}/api/public-auth/request-otp`, {
    data: { phone },
  });
  expect(requestOtp.ok()).toBeTruthy();
  const requestBody = (await requestOtp.json()) as { challenge_id?: string };
  expect(requestBody.challenge_id).toBeTruthy();

  const verifyOtp = await page.request.post(`${portalBase}/api/public-auth/verify-otp`, {
    data: { phone, otp: CATALOG_DEV_OTP, challenge_id: requestBody.challenge_id },
  });
  expect(verifyOtp.ok()).toBeTruthy();

  await page.goto(`${portalBase}/catalog/${tourId}/register`, {
    waitUntil: "domcontentloaded",
  });

  await expect(
    page
      .locator(
        "[data-registration-resume='intake'], [data-public-registration-intake], [data-public-registration-profile]"
      )
      .first()
  ).toBeVisible({ timeout: 120_000 });
}

export async function readSessionCookieMetadata(context: BrowserContext): Promise<{
  readonly name: string;
  readonly domain: string;
  readonly path: string;
  readonly sameSite: string;
  readonly secure: boolean;
} | null> {
  const cookies = await context.cookies();
  const session = cookies.find((c) => c.name === "atour_mb_session");
  if (session === undefined) {
    return null;
  }
  return {
    name: session.name,
    domain: session.domain,
    path: session.path,
    sameSite: session.sameSite,
    secure: session.secure,
  };
}

export async function assertNoStandaloneLogin(page: Page): Promise<void> {
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
  await expect(page.locator("[data-portal-login-full-page]")).toHaveCount(0);
}
