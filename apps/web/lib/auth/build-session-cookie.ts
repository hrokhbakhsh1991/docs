import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { SESSION_TOKEN_COOKIE } from "./session-cookie";

export type SessionCookieOptionsInput = {
  token: string;
  maxAgeSeconds?: number;
};

/**
 * Default cookie lifetime: 7 days (must match backend JWT TTL).
 * Callers must pass this on every Set-Cookie so the browser stores a persistent cookie.
 */
export const SESSION_COOKIE_MAX_AGE_SECONDS = 604_800;

/** Opt out of shared dev domain (`host-only` cookie on the login host only). */
export const SESSION_COOKIE_HOST_ONLY = "host-only";

function normalizeCookieDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === SESSION_COOKIE_HOST_ONLY) {
    return "";
  }
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
}

/** Legacy dev default; clear on login when using host-only cookies. */
export const LEGACY_DEV_SESSION_COOKIE_DOMAIN = ".localhost";

/**
 * Cookie `Domain` for workspace subdomain sharing.
 *
 * - **Production:** `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` (e.g. `.company.com`), or normalized tenant root.
 * - **Development:** host-only by default (Chrome stores reliably on `*.localhost`).
 * - **Opt-in dev sharing:** `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.localhost`
 * - **Explicit host-only:** `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=host-only`
 */
export function resolveSessionCookieDomain(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN?.trim();
  if (explicit) {
    const normalized = normalizeCookieDomain(explicit);
    return normalized || undefined;
  }

  if (process.env.NODE_ENV === "production") {
    const root = process.env.NEXT_PUBLIC_TENANT_ROOT_DOMAIN?.trim().toLowerCase();
    return root ? normalizeCookieDomain(root) || undefined : undefined;
  }

  return undefined;
}

function sessionCookieDomain(): string | undefined {
  return resolveSessionCookieDomain();
}

function sessionSameSite(): "strict" | "lax" | "none" {
  const raw = process.env.NEXT_PUBLIC_SESSION_COOKIE_SAME_SITE?.trim().toLowerCase();
  if (raw === "none" || raw === "lax" || raw === "strict") {
    return raw;
  }
  return process.env.NODE_ENV === "production" ? "none" : "lax";
}

/**
 * Single session cookie builder (Phase 16.3).
 *
 * DEV  : host-only unless `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=.localhost` is set.
 * PROD : `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` + SameSite=None + Secure.
 *
 * Cross-port (`:3000` UI → `:3001` Nest) never sends this cookie; Nest uses `Authorization: Bearer`
 * from the localStorage mirror (`lib/auth/session.ts`).
 */
/** Clears the session cookie using the same domain/sameSite/secure policy as set. */
export function buildClearSessionCookieOptions(): ResponseCookie {
  const base = buildSessionCookieOptions({ token: "", maxAgeSeconds: 0 });
  return {
    ...base,
    value: "",
    expires: new Date(0),
    maxAge: 0,
  };
}

/**
 * Clears a host-only `session` cookie (no `Domain` attribute).
 * Needed when migrating to `Domain=.localhost` — browsers may keep sending an older
 * host-only cookie that shadows the new domain-scoped one.
 */
export function buildClearHostOnlySessionCookieOptions(): ResponseCookie {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = sessionSameSite();
  const secure = isProd || sameSite === "none";
  return {
    name: SESSION_TOKEN_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite,
    secure,
    expires: new Date(0),
    maxAge: 0,
  };
}

/** True when session cookies use a `Domain` attribute (dev `.localhost`, prod tenant root). */
export function shouldClearLegacyHostOnlySessionCookie(): boolean {
  return Boolean(sessionCookieDomain());
}

/** Clears a domain-scoped session cookie (e.g. legacy `Domain=.localhost`). */
export function buildClearDomainScopedSessionCookieOptions(
  domain: string,
): ResponseCookie {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = sessionSameSite();
  const secure = isProd || sameSite === "none";
  const normalized = normalizeCookieDomain(domain);
  return {
    name: SESSION_TOKEN_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite,
    secure,
    domain: normalized,
    expires: new Date(0),
    maxAge: 0,
  };
}

function shouldClearLegacyDomainScopedSessionCookie(): boolean {
  return !sessionCookieDomain() && process.env.NODE_ENV !== "production";
}

/** Set session cookie and drop stale duplicates (host-only vs domain-scoped). */
export function setSessionCookieOnResponse(
  response: { cookies: { set: (cookie: ResponseCookie) => void } },
  input: SessionCookieOptionsInput,
): void {
  if (shouldClearLegacyHostOnlySessionCookie()) {
    response.cookies.set(buildClearHostOnlySessionCookieOptions());
  }
  if (shouldClearLegacyDomainScopedSessionCookie()) {
    response.cookies.set(
      buildClearDomainScopedSessionCookieOptions(LEGACY_DEV_SESSION_COOKIE_DOMAIN),
    );
  }
  response.cookies.set(buildSessionCookieOptions(input));
}

/** Clear active and legacy session cookie variants for this environment. */
export function clearAllSessionCookiesOnResponse(response: {
  cookies: { set: (cookie: ResponseCookie) => void };
}): void {
  response.cookies.set(buildClearSessionCookieOptions());
  if (shouldClearLegacyHostOnlySessionCookie()) {
    response.cookies.set(buildClearHostOnlySessionCookieOptions());
  }
  if (shouldClearLegacyDomainScopedSessionCookie()) {
    response.cookies.set(
      buildClearDomainScopedSessionCookieOptions(LEGACY_DEV_SESSION_COOKIE_DOMAIN),
    );
  }
}

export function buildSessionCookieOptions(
  input: SessionCookieOptionsInput,
): ResponseCookie {
  const isProd = process.env.NODE_ENV === "production";
  const sameSite = sessionSameSite();
  const secure = isProd || sameSite === "none";
  const domain = sessionCookieDomain();

  const trimmedToken = input.token.trim();
  const maxAgeSeconds =
    input.maxAgeSeconds !== undefined
      ? input.maxAgeSeconds
      : trimmedToken
        ? SESSION_COOKIE_MAX_AGE_SECONDS
        : undefined;

  return {
    name: SESSION_TOKEN_COOKIE,
    value: input.token,
    path: "/",
    httpOnly: true,
    sameSite,
    secure,
    ...(domain ? { domain } : {}),
    ...(maxAgeSeconds !== undefined ? { maxAge: maxAgeSeconds } : {}),
  };
}
