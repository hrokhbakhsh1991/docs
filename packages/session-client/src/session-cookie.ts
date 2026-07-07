import { SESSION_COOKIE_MAX_AGE_SECONDS } from "./session-cookie-names";

export type SessionCookieWriteOptions = {
  readonly domain?: string;
};

export type SessionCookieOptions = {
  readonly name: string;
  readonly value: string;
  readonly httpOnly: true;
  readonly secure: boolean;
  readonly sameSite: "lax";
  readonly path: "/";
  readonly maxAge: number;
  readonly domain?: string;
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
  token: string,
  writeOptions?: SessionCookieWriteOptions
): SessionCookieOptions {
  const domain = writeOptions?.domain?.trim();
  return {
    name: cookieName,
    value: token,
    httpOnly: true,
    secure: resolveSessionCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    ...(domain && domain.length > 0 ? { domain } : {}),
  };
}

function appendDomainAttribute(parts: string[], domain?: string): void {
  const normalized = domain?.trim();
  if (normalized && normalized.length > 0) {
    parts.push(`Domain=${normalized}`);
  }
}

export function setSessionCookieOnResponse(
  headers: Headers,
  cookieName: string,
  token: string,
  writeOptions?: SessionCookieWriteOptions
): void {
  const cookie = buildSessionCookieOptions(cookieName, token, writeOptions);
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`,
  ];
  appendDomainAttribute(parts, cookie.domain);
  if (cookie.secure) {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}

export function clearSessionCookieOnResponse(
  headers: Headers,
  cookieName: string,
  writeOptions?: SessionCookieWriteOptions
): void {
  const parts = [
    `${cookieName}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  appendDomainAttribute(parts, writeOptions?.domain);
  if (resolveSessionCookieSecure()) {
    parts.push("Secure");
  }
  headers.append("Set-Cookie", parts.join("; "));
}

export type SessionCookieHelpers = {
  readonly cookieName: string;
  readonly SESSION_COOKIE_MAX_AGE_SECONDS: number;
  resolveSessionCookieSecure: typeof resolveSessionCookieSecure;
  buildSessionCookieOptions: (
    token: string,
    writeOptions?: SessionCookieWriteOptions
  ) => SessionCookieOptions;
  setSessionCookieOnResponse: (
    headers: Headers,
    token: string,
    writeOptions?: SessionCookieWriteOptions
  ) => void;
  clearSessionCookieOnResponse: (
    headers: Headers,
    writeOptions?: SessionCookieWriteOptions
  ) => void;
};

export function createSessionCookieHelpers(cookieName: string): SessionCookieHelpers {
  return {
    cookieName,
    SESSION_COOKIE_MAX_AGE_SECONDS,
    resolveSessionCookieSecure,
    buildSessionCookieOptions: (token: string, writeOptions?: SessionCookieWriteOptions) =>
      buildSessionCookieOptions(cookieName, token, writeOptions),
    setSessionCookieOnResponse: (
      headers: Headers,
      token: string,
      writeOptions?: SessionCookieWriteOptions
    ) => setSessionCookieOnResponse(headers, cookieName, token, writeOptions),
    clearSessionCookieOnResponse: (headers: Headers, writeOptions?: SessionCookieWriteOptions) =>
      clearSessionCookieOnResponse(headers, cookieName, writeOptions),
  };
}
