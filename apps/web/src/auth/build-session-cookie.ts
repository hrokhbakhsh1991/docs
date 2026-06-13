import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_TOKEN_COOKIE = "session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 604_800;

/** HTTP staging/VPS may set SESSION_COOKIE_SECURE=false; default follows NODE_ENV. */
export function resolveSessionCookieSecure(): boolean {
  const raw = process.env.SESSION_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "no") {
    return false;
  }
  if (raw === "true" || raw === "1" || raw === "yes") {
    return true;
  }
  return process.env.NODE_ENV === "production";
}

export function buildSessionCookieOptions(token: string): ResponseCookie {
  return {
    name: SESSION_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: resolveSessionCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

export function setSessionCookieOnResponse(
  headers: Headers,
  token: string
): void {
  const cookie = buildSessionCookieOptions(token);
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
  ];
  if (resolveSessionCookieSecure()) {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookieOnResponse(headers: Headers): void {
  const parts = [
    `${SESSION_TOKEN_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (resolveSessionCookieSecure()) {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}
