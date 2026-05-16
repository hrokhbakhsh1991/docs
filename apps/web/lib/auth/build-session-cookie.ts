import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";
import { SESSION_TOKEN_COOKIE } from "./session-cookie";

export type SessionCookieOptionsInput = {
  token: string;
  maxAgeSeconds?: number;
};

function sessionCookieDomain(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_SESSION_COOKIE_DOMAIN?.trim();
  if (explicit) {
    return explicit;
  }
  // Host-only cookie (no Domain). Chromium rejects Domain=.localhost on *.localhost hosts.
  return undefined;
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
 * DEV: host-only cookie (no Domain) unless NEXT_PUBLIC_SESSION_COOKIE_DOMAIN is set.
 * PROD: set NEXT_PUBLIC_SESSION_COOKIE_DOMAIN (e.g. .company.com) + SameSite=None + Secure.
 */
/** Clears the session cookie using the same domain/sameSite/secure policy as set. */
export function buildClearSessionCookieOptions(): ResponseCookie {
  const base = buildSessionCookieOptions({ token: "" });
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

  return {
    name: SESSION_TOKEN_COOKIE,
    value: input.token,
    path: "/",
    httpOnly: true,
    sameSite,
    secure,
    ...(domain ? { domain } : {}),
    ...(input.maxAgeSeconds !== undefined ? { maxAge: input.maxAgeSeconds } : {}),
  };
}
