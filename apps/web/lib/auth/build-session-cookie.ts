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

/**
 * Cookie `Domain` for workspace subdomain sharing.
 *
 * - **Production:** `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` (e.g. `.company.com`), or normalized tenant root.
 * - **Development:** `.localhost` by default so `denali.localhost` shares with other `*.localhost` hosts.
 * - **Override:** set `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN=host-only` for a host-only cookie.
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

  return ".localhost";
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
 * DEV  : `Domain=.localhost` unless `NEXT_PUBLIC_SESSION_COOKIE_DOMAIN` overrides.
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
