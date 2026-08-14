/**
 * Phase 9.8 — Playwright operator session helpers
 * Authority: docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 *
 * Uses BFF API login (not UI submit) so the `session` cookie is in Playwright
 * storage before `/api/users/*` client fetches (SMK-P9-03).
 */
import { expect, type Page } from "@playwright/test";

import { resolveOperatorSmokeOwnerMobile } from "../../scripts/operator-smoke-identity.mjs";
import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";

/** Sync with `OPERATOR_SMOKE.ownerMobile` / staging seed (override via env on VPS). */
export const OPERATOR_OWNER_MOBILE = resolveOperatorSmokeOwnerMobile();
export const OPERATOR_ADMIN_MOBILE = "+15550001002";
export const OPERATOR_MEMBER_MOBILE = "+15550001003";
export const OPERATOR_MEMBER_DISPLAY_NAME = "Smoke Member";
export const OPERATOR_ADMIN_DISPLAY_NAME = "Smoke Admin";
export const OPERATOR_SMOKE_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000102";
export const OPERATOR_DEV_OTP = process.env.OPERATOR_DEV_OTP?.trim() || "1234";
export const OPERATOR_INVITEE_MOBILE = "+15550008803";

const OPERATOR_SESSION_TOKEN_CACHE = new Map<string, string>();

function resolvePlaywrightBaseUrl(): string | null {
  for (const candidate of [
    process.env.PLAYWRIGHT_BASE_URL,
    process.env.SMOKE_BASE_URL,
    process.env.SMOKE_WEB_BASE_URL,
  ]) {
    const trimmed = candidate?.trim();
    if (trimmed !== undefined && trimmed.length > 0) {
      return trimmed;
    }
  }
  return null;
}

async function probeRequestHostname(page: Page): Promise<string | null> {
  const probeRes = await page.request.get("/", {
    failOnStatusCode: false,
  });
  const probeUrl = probeRes.url().trim();
  if (probeUrl.length === 0) {
    return null;
  }
  return new URL(probeUrl).hostname;
}

export async function resolveOperatorRequestHostname(page: Page): Promise<string> {
  const configuredBaseUrl = resolvePlaywrightBaseUrl();
  if (configuredBaseUrl !== null) {
    return new URL(configuredBaseUrl).hostname;
  }

  const currentUrl = page.url().trim();
  if (currentUrl.length > 0 && currentUrl !== "about:blank") {
    return new URL(currentUrl).hostname;
  }

  const probedHostname = await probeRequestHostname(page);
  expect(
    probedHostname,
    "Unable to resolve operator request host. Set PLAYWRIGHT_BASE_URL/SMOKE_BASE_URL or navigate the page before logging in."
  ).not.toBeNull();
  return probedHostname!;
}

async function persistOperatorSessionCookie(
  page: Page,
  loginBody: { session_token?: string }
): Promise<void> {
  expect(typeof loginBody.session_token).toBe("string");
  const domain = await resolveOperatorRequestHostname(page);
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      domain,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function cacheKeyForOperatorSession(page: Page, phone: string): Promise<string> {
  return `${await resolveOperatorRequestHostname(page)}::${phone.trim()}`;
}

async function loginOperatorSessionViaBff(
  page: Page,
  phone: string,
  skipAbilityPreflight = false,
  forceFresh = false
): Promise<void> {
  const cacheKey = await cacheKeyForOperatorSession(page, phone);
  const cachedToken = forceFresh ? undefined : OPERATOR_SESSION_TOKEN_CACHE.get(cacheKey);
  if (cachedToken !== undefined) {
    await persistOperatorSessionCookie(page, { session_token: cachedToken });
    if (!skipAbilityPreflight) {
      const abilityRes = await page.request.get("/api/auth/membership-ability-context");
      expect(abilityRes.ok()).toBeTruthy();
    }
    return;
  }

  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone },
  });
  const otpText = await otpRes.text();
  expect(otpRes.ok(), `request-otp failed (${otpRes.status()}): ${otpText}`).toBeTruthy();
  const otpBody = JSON.parse(otpText) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone,
      otp: OPERATOR_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
  });
  const loginText = await loginRes.text();
  expect(
    loginRes.ok(),
    `login-web-session failed (${loginRes.status()}): ${loginText}`
  ).toBeTruthy();
  const loginBody = JSON.parse(loginText) as { session_token?: string };
  await persistOperatorSessionCookie(page, loginBody);
  OPERATOR_SESSION_TOKEN_CACHE.set(cacheKey, loginBody.session_token!);

  if (skipAbilityPreflight) {
    return;
  }

  const abilityRes = await page.request.get("/api/auth/membership-ability-context");
  expect(abilityRes.ok()).toBeTruthy();
}

export async function loginOperatorWithPhone(
  page: Page,
  phone: string,
  options?: {
    readonly inviteToken?: string;
    readonly skipDashboard?: boolean;
    readonly skipAbilityPreflight?: boolean;
  }
): Promise<void> {
  await loginOperatorSessionViaBff(page, phone, options?.skipAbilityPreflight === true);

  if (options?.inviteToken !== undefined && options.inviteToken.length > 0) {
    const acceptRes = await page.request.post(
      `/api/auth/invite/${encodeURIComponent(options.inviteToken)}/accept`
    );
    const acceptText = await acceptRes.text();
    expect(acceptRes.ok(), acceptText).toBeTruthy();
    await loginOperatorSessionViaBff(page, phone, options?.skipAbilityPreflight === true, true);
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

/** Resolve workspace id from BFF session (draft API namespace). */
export async function resolveOperatorWorkspaceId(page: Page): Promise<string> {
  const sessionRes = await page.request.get("/api/auth/session");
  expect(sessionRes.ok()).toBeTruthy();
  const session = (await sessionRes.json()) as {
    workspace_id?: string | null;
    workspaceId?: string | null;
  };
  let workspaceId = (session.workspace_id ?? session.workspaceId ?? "").trim();
  if (workspaceId.length > 0) {
    return workspaceId;
  }

  const abilityRes = await page.request.get("/api/auth/membership-ability-context");
  expect(abilityRes.ok()).toBeTruthy();
  const ability = (await abilityRes.json()) as {
    workspace_id?: string | null;
    workspaceId?: string | null;
  };
  workspaceId = (ability.workspaceId ?? ability.workspace_id ?? "").trim();
  expect(workspaceId.length).toBeGreaterThan(0);
  return workspaceId;
}
