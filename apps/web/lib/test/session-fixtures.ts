import { SESSION_TOKEN_COOKIE } from "../auth/session-cookie";

import { createJsonResponse } from "./fetch-response";

export { SESSION_TOKEN_COOKIE };

/** localStorage mirror key (see `lib/auth/session.ts`). */
export const SESSION_TOKEN_STORAGE_KEY = "tour_ops_session_token";

/** Default Vitest auth-hydration actor ids. */
export const DEFAULT_TEST_USER_ID = "11111111-1111-4111-8111-111111111111";
export const DEFAULT_TEST_TENANT_ID = "22222222-2222-4222-8222-222222222222";

/** Default Playwright smoke actor / tenant. */
export const SMOKE_TEST_USER_SUB = "user-smoke-1";
export const SMOKE_WIZARD_JWT_TENANT_ID = "00311449-1df0-4413-8d61-26c6ac82e9ed";

export type TestSessionJwtClaims = {
  sub: string;
  tenant_id: string;
  role?: string;
  sess_ver?: number;
};

export function base64UrlJson(value: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(value))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * RS256-shaped JWT for cookie + BFF hydrate tests (`header.payload.signature`).
 */
export function buildTestSessionJwt(
  claims: Partial<TestSessionJwtClaims> = {},
  signature = "mock-signature",
): string {
  const sub = claims.sub ?? DEFAULT_TEST_USER_ID;
  const tenant_id = claims.tenant_id ?? DEFAULT_TEST_TENANT_ID;
  const role = claims.role ?? "owner";
  const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlJson({
    sub,
    tenant_id,
    role,
    ...(claims.sess_ver != null ? { sess_ver: claims.sess_ver } : {}),
  });
  return `${header}.${payload}.${signature}`;
}

/**
 * Minimal smoke JWT (`smoke.<payload>.sig`) — middleware / Playwright.
 */
export function buildSmokeSessionJwt(
  tenantId: string = SMOKE_WIZARD_JWT_TENANT_ID,
  role = "owner",
  sub: string = SMOKE_TEST_USER_SUB,
): string {
  return (
    "smoke." +
    Buffer.from(
      JSON.stringify({
        sub,
        tenant_id: tenantId,
        role,
      }),
    ).toString("base64url") +
    ".sig"
  );
}

export const LEADER_SMOKE_SESSION_JWT = buildSmokeSessionJwt();

export type SessionHydrateBody = {
  authenticated: boolean;
  session_token?: string;
  user_id?: string;
  tenant_id?: string;
  user?: { userId: string; tenantId: string; role?: string };
};

export function buildSessionHydrateJson(
  sessionToken: string,
  options: {
    userId?: string;
    tenantId?: string;
    role?: string;
    overrides?: Partial<SessionHydrateBody>;
  } = {},
): SessionHydrateBody {
  const userId = options.userId ?? DEFAULT_TEST_USER_ID;
  const tenantId = options.tenantId ?? DEFAULT_TEST_TENANT_ID;
  const role = options.role ?? "owner";
  return {
    authenticated: true,
    session_token: sessionToken,
    user_id: userId,
    tenant_id: tenantId,
    user: { userId, tenantId, role },
    ...options.overrides,
  };
}

/** Mock `GET /api/auth/session` success body. */
export function createSessionHydrateResponse(
  sessionToken: string,
  options: {
    userId?: string;
    tenantId?: string;
    role?: string;
    overrides?: Partial<SessionHydrateBody>;
  } = {},
): Response {
  return createJsonResponse(buildSessionHydrateJson(sessionToken, options));
}

export function createUnauthenticatedSessionResponse(): Response {
  return createJsonResponse({ authenticated: false });
}

export function createMembershipAbilityContextResponse(): Response {
  return createJsonResponse({ labels: [], capabilities: [] });
}

export function setDocumentSessionCookie(sessionToken: string): void {
  document.cookie = `${SESSION_TOKEN_COOKIE}=${encodeURIComponent(sessionToken)}; path=/`;
}

export function clearDocumentSessionCookie(): void {
  document.cookie = "";
}
