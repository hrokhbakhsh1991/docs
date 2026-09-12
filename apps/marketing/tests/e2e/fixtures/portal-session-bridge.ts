import { expect, type BrowserContext, type Page } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  fillCatalogOtp,
  requestRegistrationOtp,
} from "./catalog-registration-otp";
import { resolveSmokePublishedTourId } from "./smoke-published-tour";

let smokePhoneSequence = 0;

export function resolveSmokeMemberPhone(): string {
  smokePhoneSequence += 1;
  return `+1555${String(Date.now() + smokePhoneSequence).slice(-7)}`;
}

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

/** Cookie Domain suffix for the active smoke tenant (e.g. `denali.localhost`). */
export function resolveSessionCookieDomainSuffix(): string {
  const marketingHost = new URL(resolveMarketingBaseUrl()).hostname;
  if (marketingHost === "denali.club") {
    return "denali.club";
  }
  if (marketingHost.endsWith(".localhost")) {
    return marketingHost;
  }
  return "operator.localhost";
}

/** Portal-first OTP login — establishes shared atour_mb_session before marketing PDP. */
export async function authenticateMemberViaPortal(
  page: Page,
  input: { readonly phone?: string; readonly tourId?: string } = {}
): Promise<void> {
  const phone = input.phone ?? resolveSmokeMemberPhone();
  const tourId = input.tourId ?? resolveSmokeTourId();
  const portalBase = resolvePortalBaseUrl();
  const portalOrigin = new URL(portalBase);
  // Node's APIRequestContext does not honor Chromium's host-resolver-rules and
  // resolves *.localhost to ::1, while the smoke portal listens on IPv4.
  // Keep the public Host header for tenant routing, but connect to IPv4.
  const portalInternalBase = `http://127.0.0.1:${portalOrigin.port || "3003"}`;
  const portalHeaders = { host: portalOrigin.host };

  const requestOtp = await page.request.post(`${portalInternalBase}/api/public-auth/request-otp`, {
    data: { phone },
    headers: portalHeaders,
  });
  expect(requestOtp.ok()).toBeTruthy();
  const requestBody = (await requestOtp.json()) as { challenge_id?: string };
  expect(requestBody.challenge_id).toBeTruthy();

  const verifyOtp = await page.request.post(`${portalInternalBase}/api/public-auth/verify-otp`, {
    data: { phone, otp: CATALOG_DEV_OTP, challenge_id: requestBody.challenge_id },
    headers: portalHeaders,
  });
  expect(verifyOtp.ok()).toBeTruthy();

  await page.goto(`${portalBase}/catalog/${tourId}/register`, {
    waitUntil: "domcontentloaded",
  });

  const registrationSurface = page.locator(
    "[data-registration-resume='intake'], [data-public-registration-intake], [data-public-registration-profile]"
  );
  if ((await registrationSurface.count()) === 0) {
    await requestRegistrationOtp(page, phone);
    await fillCatalogOtp(page, CATALOG_DEV_OTP);
  }

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Marketing Bridge Smoke");
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      page.locator('[data-action="profile-continue"]').click(),
    ]);
  }

  // register-complete triggers a client refresh; wait for the settled intake
  // state before handing the same page/context to the Marketing surface.
  await expect(page.locator("[data-registration-resume='intake']")).toBeVisible({
    timeout: 120_000,
  });

  const storage = await page.request.storageState();
  if (storage.cookies.length > 0) {
    const cookieDomain = resolveSessionCookieDomainSuffix();
    await page
      .context()
      .addCookies(
        storage.cookies.map((cookie) =>
          cookie.domain === "127.0.0.1" || cookie.domain === "localhost"
            ? { ...cookie, domain: cookieDomain }
            : cookie
        )
      );
  }

  await expect(registrationSurface.first()).toBeVisible({ timeout: 120_000 });
}

export async function readSessionCookieMetadata(context: BrowserContext): Promise<{
  readonly name: string;
  readonly domain: string;
  readonly path: string;
  readonly sameSite: string;
  readonly secure: boolean;
} | null> {
  const marketingBase = resolveMarketingBaseUrl();
  const portalBase = resolvePortalBaseUrl();
  const cookies = await context.cookies(marketingBase, portalBase);
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
