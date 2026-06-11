import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

export const SESSION_TOKEN_COOKIE = "session";
export const SESSION_COOKIE_MAX_AGE_SECONDS = 604_800;

export function buildSessionCookieOptions(token: string): ResponseCookie {
  return {
    name: SESSION_TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
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
  if (cookie.secure) {
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
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}
