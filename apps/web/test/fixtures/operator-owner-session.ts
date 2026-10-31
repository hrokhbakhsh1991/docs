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
import { OPERATOR_WELCOME_ARMED_COOKIE } from "../../src/auth/operator-welcome-cookie";

/** Sync with `OPERATOR_SMOKE.ownerMobile` / staging seed (override via env on VPS). */
export const OPERATOR_OWNER_MOBILE = resolveOperatorSmokeOwnerMobile();
export const OPERATOR_ADMIN_MOBILE = "+15550001002";
export const OPERATOR_MEMBER_MOBILE = "+15550001003";
export const OPERATOR_VIEWER_TEST_MOBILE =
  process.env.OPERATOR_SMOKE_VIEWER_MOBILE?.trim() || "+15550001004";
export const OPERATOR_MEMBER_DISPLAY_NAME = "Smoke Member";
export const OPERATOR_ADMIN_DISPLAY_NAME = "Smoke Admin";
export const OPERATOR_SMOKE_ADMIN_USER_ID = "00000000-0000-4000-8000-000000000102";
export const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
export const OPERATOR_SMOKE_OWNER_USER_ID = "00000000-0000-4000-8000-000000000101";
export const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
export const OPERATOR_DEV_OTP = process.env.OPERATOR_DEV_OTP?.trim() || "1234";
export const OPERATOR_INVITEE_MOBILE = "+15550008803";
export const OPERATOR_ANONYMOUS_OTP_USER_ID = "00000000-0000-4000-8000-000000000099";
export const OPERATOR_SMOKE_COOKIE_DOMAIN = "admin.operator.localhost";

const OPERATOR_SESSION_TOKEN_CACHE = new Map<string, string>();

function resolveOperatorCookieUrl(page: Page): string {
  const context = page.context() as {
    readonly _options?: { readonly baseURL?: string };
  };
  const baseURL = context._options?.baseURL?.trim();
  if (typeof baseURL === "string" && baseURL.length > 0) {
    return baseURL.endsWith("/") ? baseURL.slice(0, -1) : baseURL;
  }
  return `http://${OPERATOR_SMOKE_COOKIE_DOMAIN}:3000`;
}

function readRequestCookieDomain(page: Page): string {
  const context = page.context() as {
    readonly _options?: { readonly baseURL?: string };
  };
  const baseURL = context._options?.baseURL;
  if (typeof baseURL === "string" && baseURL.length > 0) {
    return new URL(baseURL).hostname;
  }
  try {
    const href = page.url();
    if (href.length > 0 && href !== "about:blank") {
      return new URL(href).hostname;
    }
  } catch {
    // ignore invalid page URL
  }
  return "localhost";
}

async function persistOperatorSessionCookie(
  page: Page,
  loginBody: { session_token?: string }
): Promise<void> {
  expect(typeof loginBody.session_token).toBe("string");
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      url: resolveOperatorCookieUrl(page),
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

function cacheKeyForOperatorSession(page: Page, phone: string): string {
  return `${readRequestCookieDomain(page)}::${phone.trim()}`;
}

async function loginOperatorTeamSessionViaBff(
  page: Page,
  phone: string,
  forceFresh = false
): Promise<void> {
  await page.context().clearCookies();

  const cacheKey = cacheKeyForOperatorSession(page, phone);
  const cachedToken = forceFresh ? undefined : OPERATOR_SESSION_TOKEN_CACHE.get(cacheKey);
  if (cachedToken !== undefined) {
    await persistOperatorSessionCookie(page, { session_token: cachedToken });
    return;
  }

  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone },
  });
  const otpText = await otpRes.text();
  expect(otpRes.ok(), `request-otp failed (${otpRes.status()}): ${otpText}`).toBeTruthy();
  const otpBody = JSON.parse(otpText) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-team-web-session", {
    data: {
      phone,
      otp: OPERATOR_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
  });
  const loginText = await loginRes.text();
  expect(
    loginRes.ok(),
    `login-team-web-session failed (${loginRes.status()}): ${loginText}`
  ).toBeTruthy();
  const loginBody = JSON.parse(loginText) as { session_token?: string };
  expect(typeof loginBody.session_token).toBe("string");
  await persistOperatorSessionCookie(page, loginBody);
  OPERATOR_SESSION_TOKEN_CACHE.set(cacheKey, loginBody.session_token!);
}

export async function loginOperatorTeamSessionWithPhone(
  page: Page,
  phone: string,
  forceFresh = false
): Promise<void> {
  await loginOperatorTeamSessionViaBff(page, phone, forceFresh);
}

async function loginOperatorSessionViaBff(
  page: Page,
  phone: string,
  skipAbilityPreflight = false,
  forceFresh = false,
  inviteToken?: string
): Promise<void> {
  const cacheKey = cacheKeyForOperatorSession(page, phone);
  const cachedToken = forceFresh ? undefined : OPERATOR_SESSION_TOKEN_CACHE.get(cacheKey);
  if (cachedToken !== undefined) {
    await persistOperatorSessionCookie(page, { session_token: cachedToken });
    if (!skipAbilityPreflight) {
      const abilityRes = await page.request.get("/api/auth/membership-ability-context");
      if (!abilityRes.ok()) {
        OPERATOR_SESSION_TOKEN_CACHE.delete(cacheKey);
        return loginOperatorSessionViaBff(page, phone, skipAbilityPreflight, true);
      }
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
      ...(inviteToken !== undefined && inviteToken.length > 0 ? { invite_token: inviteToken } : {}),
    },
  });
  const loginText = await loginRes.text();
  expect(
    loginRes.ok(),
    `login-web-session failed (${loginRes.status()}): ${loginText}`
  ).toBeTruthy();
  const loginBody = JSON.parse(loginText) as { session_token?: string };
  await persistOperatorSessionCookie(page, loginBody);
  // APIRequestContext does not consistently mirror this non-HttpOnly
  // login-scoped cookie into the page jar across Playwright versions.
  // Preserve the BFF contract explicitly so the welcome gate tests a real
  // post-login state rather than an accidental cached-session state.
  if (loginRes.headers()["set-cookie"]?.includes(`${OPERATOR_WELCOME_ARMED_COOKIE}=1`)) {
    await page.context().addCookies([
      {
        name: OPERATOR_WELCOME_ARMED_COOKIE,
        value: "1",
        domain: readRequestCookieDomain(page),
        path: "/",
        sameSite: "Lax",
      },
    ]);
  }
  OPERATOR_SESSION_TOKEN_CACHE.set(cacheKey, loginBody.session_token!);

  if (skipAbilityPreflight) {
    return;
  }

  const abilityRes = await page.request.get("/api/auth/membership-ability-context");
  expect(abilityRes.ok(), await abilityRes.text()).toBeTruthy();
}

export async function loginOperatorWithPhone(
  page: Page,
  phone: string,
  options?: {
    readonly inviteToken?: string;
    readonly skipDashboard?: boolean;
    readonly skipAbilityPreflight?: boolean;
    /** Force the BFF login transition so login-scoped cookies are re-armed. */
    readonly forceFresh?: boolean;
  }
): Promise<void> {
  await loginOperatorSessionViaBff(
    page,
    phone,
    options?.skipAbilityPreflight === true,
    options?.forceFresh === true,
    options?.inviteToken
  );

  if (options?.inviteToken !== undefined && options.inviteToken.length > 0) {
    const acceptRes = await page.request.post(
      `/api/auth/invite/${encodeURIComponent(options.inviteToken)}/accept`
    );
    const acceptText = await acceptRes.text();
    expect(acceptRes.ok(), acceptText).toBeTruthy();
    // Keep the constrained pre-accept session through the transition. A fresh
    // direct login is intentionally rejected for active non-owner members.
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

export async function loginOperatorAdmin(page: Page): Promise<void> {
  await loginOperatorWithPhone(page, OPERATOR_ADMIN_MOBILE);
}

export async function loginOperatorViewer(page: Page): Promise<void> {
  const phone = OPERATOR_VIEWER_TEST_MOBILE;

  // Ensure the dedicated synthetic phone has an active viewer membership in
  // this tenant. Public registration creates a member first; the owner then
  // assigns the test-only viewer role through the normal users API.
  await loginOperatorOwner(page);

  const pendingInvitesRes = await page.request.get("/api/users/invites");
  const pendingInvitesText = await pendingInvitesRes.text();
  expect(
    pendingInvitesRes.ok(),
    `pending invite list failed (${pendingInvitesRes.status()}): ${pendingInvitesText}`
  ).toBeTruthy();
  const pendingInvitesBody = JSON.parse(pendingInvitesText) as {
    items?: readonly { inviteId?: string; phone?: string; role?: string }[];
  };
  const pendingViewerInvite = pendingInvitesBody.items?.find(
    (invite) => invite.phone === phone && invite.role === "viewer"
  );
  if (pendingViewerInvite?.inviteId) {
    const revokeRes = await page.request.delete(
      `/api/users/invites/${encodeURIComponent(pendingViewerInvite.inviteId)}`
    );
    expect(
      revokeRes.status(),
      `stale viewer invite revoke failed (${revokeRes.status()}): ${await revokeRes.text()}`
    ).toBe(204);
  }

  const readViewerUser = async (): Promise<{
    readonly userId: string;
    readonly role: string;
  } | null> => {
    const response = await page.request.get(
      `/api/users?search=${encodeURIComponent(phone)}&limit=10`
    );
    const responseText = await response.text();
    expect(
      response.ok(),
      `viewer test user lookup failed (${response.status()}): ${responseText}`
    ).toBeTruthy();
    const body = JSON.parse(responseText) as {
      items?: readonly {
        readonly userId?: string;
        readonly id?: string;
        readonly mobile?: string;
        readonly phone?: string;
        readonly role?: string;
      }[];
    };
    const user = body.items?.find((item) => item.mobile === phone || item.phone === phone);
    const userId = user?.userId ?? user?.id;
    return userId && user?.role ? { userId, role: user.role } : null;
  };

  let viewerUser = await readViewerUser();
  if (viewerUser === null) {
    const portalBase = (
      process.env.SMOKE_PORTAL_OPERATOR_BASE_URL ?? "http://operator.portal.localhost:3003"
    ).replace(/\/$/, "");
    const portalHost = new URL(portalBase).host;
    const requestOtpRes = await page.request.post(`${portalBase}/api/public-auth/request-otp`, {
      headers: { host: portalHost },
      data: { phone },
    });
    const requestOtpText = await requestOtpRes.text();
    expect(
      requestOtpRes.ok(),
      `viewer public OTP request failed (${requestOtpRes.status()}): ${requestOtpText}`
    ).toBeTruthy();
    const requestOtpBody = JSON.parse(requestOtpText) as { challenge_id?: string };
    expect(typeof requestOtpBody.challenge_id).toBe("string");

    const verifyOtpRes = await page.request.post(`${portalBase}/api/public-auth/verify-otp`, {
      headers: { host: portalHost },
      data: {
        phone,
        otp: OPERATOR_DEV_OTP,
        challenge_id: requestOtpBody.challenge_id,
      },
    });
    const verifyOtpText = await verifyOtpRes.text();
    expect(
      verifyOtpRes.ok(),
      `viewer public OTP verification failed (${verifyOtpRes.status()}): ${verifyOtpText}`
    ).toBeTruthy();
    const verifyOtpBody = JSON.parse(verifyOtpText) as {
      requires_registration?: boolean;
      onboarding_token?: string;
    };
    expect(verifyOtpBody.requires_registration).toBe(true);
    expect(typeof verifyOtpBody.onboarding_token).toBe("string");

    const registerRes = await page.request.post(`${portalBase}/api/public-auth/register-complete`, {
      headers: { host: portalHost },
      data: {
        onboarding_token: verifyOtpBody.onboarding_token,
        display_name: "Automated staging E2E viewer",
      },
    });
    const registerText = await registerRes.text();
    expect(
      registerRes.ok(),
      `viewer public registration failed (${registerRes.status()}): ${registerText}`
    ).toBeTruthy();
    viewerUser = await readViewerUser();
  }

  expect(
    viewerUser,
    "registered viewer test identity must appear in the tenant users list"
  ).toBeTruthy();
  if (viewerUser!.role !== "viewer") {
    const roleRes = await page.request.patch(
      `/api/users/${encodeURIComponent(viewerUser!.userId)}/role`,
      { data: { role: "viewer" } }
    );
    const roleText = await roleRes.text();
    expect(
      roleRes.ok(),
      `viewer test role assignment failed (${roleRes.status()}): ${roleText}`
    ).toBeTruthy();
  }

  await loginOperatorTeamSessionViaBff(page, phone, true);
  await page.goto("/tickets", { waitUntil: "load" });
}

export async function loginOperatorMember(page: Page): Promise<void> {
  await page.context().clearCookies();
  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: OPERATOR_MEMBER_MOBILE },
  });
  const otpText = await otpRes.text();
  expect(otpRes.ok(), `request-otp failed (${otpRes.status()}): ${otpText}`).toBeTruthy();
  const otpBody = JSON.parse(otpText) as { challenge_id?: string };
  const loginRes = await page.request.post("/api/auth/login-team-web-session", {
    data: {
      phone: OPERATOR_MEMBER_MOBILE,
      otp: OPERATOR_DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
  });
  expect(loginRes.status()).toBe(403);
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
