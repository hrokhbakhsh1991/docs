export const PLATFORM_SESSION_COOKIE = "platform_session";
export const PLATFORM_SESSION_MAX_AGE_SECONDS = 604_800;

export type PlatformOpsSessionPayload = {
  readonly phone: string;
  readonly role: "owner" | "admin" | "support";
};

export function buildPlatformSessionCookieHeader(sessionToken: string): string {
  const parts = [
    `${PLATFORM_SESSION_COOKIE}=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${PLATFORM_SESSION_MAX_AGE_SECONDS}`,
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearPlatformSessionCookieHeader(): string {
  const parts = [
    `${PLATFORM_SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  ];
  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export { parsePlatformSession, validatePlatformSessionToken } from "./validate-platform-session-token";
