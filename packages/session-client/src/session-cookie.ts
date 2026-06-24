import { SESSION_COOKIE_MAX_AGE_SECONDS } from "./session-cookie-names";

export type SessionCookieOptions = {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
};

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

export function buildSessionCookieOptions(
  cookieName: string,
  token: string
): SessionCookieOptions {
  return {
    name: cookieName,
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
  cookieName: string,
  token: string
): void {
  const cookie = buildSessionCookieOptions(cookieName, token);
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

export function clearSessionCookieOnResponse(headers: Headers, cookieName: string): void {
  const parts = [
    `${cookieName}=`,
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

export type SessionCookieHelpers = {
  readonly cookieName: string;
  readonly SESSION_COOKIE_MAX_AGE_SECONDS: number;
  resolveSessionCookieSecure: typeof resolveSessionCookieSecure;
  buildSessionCookieOptions: (token: string) => SessionCookieOptions;
  setSessionCookieOnResponse: (headers: Headers, token: string) => void;
  clearSessionCookieOnResponse: (headers: Headers) => void;
};

export function createSessionCookieHelpers(cookieName: string): SessionCookieHelpers {
  return {
    cookieName,
    SESSION_COOKIE_MAX_AGE_SECONDS,
    resolveSessionCookieSecure,
    buildSessionCookieOptions: (token: string) => buildSessionCookieOptions(cookieName, token),
    setSessionCookieOnResponse: (headers: Headers, token: string) =>
      setSessionCookieOnResponse(headers, cookieName, token),
    clearSessionCookieOnResponse: (headers: Headers) =>
      clearSessionCookieOnResponse(headers, cookieName),
  };
}
