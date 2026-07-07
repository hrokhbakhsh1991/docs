/**
 * Phase 9.8 — Playwright operator session helpers
 * Authority: docs/phase-9/appendices/SMOKE-SCENARIO-MAP.md
 *
 * Uses BFF API login (not UI submit) so the `session` cookie is in Playwright
 * storage before `/api/users/*` client fetches (SMK-P9-03).
 */
import { expect, type Page } from "@playwright/test";

import { SESSION_TOKEN_COOKIE } from "../../src/auth/build-session-cookie";

/** Sync with `OPERATOR_SMOKE.ownerMobile` / staging seed (override via env on VPS). */
export const OPERATOR_OWNER_MOBILE =
  process.env.OPERATOR_OWNER_MOBILE?.trim() || "+15550001001";
export const OPERATOR_ADMIN_MOBILE = "+15550001002";
export const OPERATOR_MEMBER_MOBILE = "+15550001003";
export const OPERATOR_MEMBER_DISPLAY_NAME = "Smoke Member";
export const OPERATOR_ADMIN_DISPLAY_NAME = "Smoke Admin";
export const OPERATOR_SMOKE_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000102";
export const OPERATOR_DEV_OTP = process.env.OPERATOR_DEV_OTP?.trim() || "1234";
export const OPERATOR_INVITEE_MOBILE = "+15550008803";

function readRequestCookieDomain(page: Page): string {
  const baseURL = page.context()._options.baseURL;
  if (typeof baseURL === "string" && baseURL.length > 0) {
    return new URL(baseURL).hostname;
  }
  return "localhost";
}

async function persistOperatorSessionCookie(page: Page, loginRes: Awaited<ReturnType<Page["request"]["post"]>>): Promise<void> {
  const loginBody = (await loginRes.json()) as { session_token?: string };
  expect(typeof loginBody.session_token).toBe("string");
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      domain: readRequestCookieDomain(page),
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function loginOperatorSessionViaBff(
  page: Page,
  phone: string,
  skipAbilityPreflight = false
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
  await persistOperatorSessionCookie(page, loginRes);

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
  await loginOperatorSessionViaBff(
    page,
    phone,
    options?.skipAbilityPreflight === true
  );

  if (options?.inviteToken !== undefined && options.inviteToken.length > 0) {
    const acceptRes = await page.request.post(
      `/api/auth/invite/${encodeURIComponent(options.inviteToken)}/accept`
    );
    const acceptText = await acceptRes.text();
    expect(acceptRes.ok(), acceptText).toBeTruthy();
    await loginOperatorSessionViaBff(
      page,
      phone,
      options?.skipAbilityPreflight === true
    );
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
