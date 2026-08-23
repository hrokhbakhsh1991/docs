import {
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_MAX_AGE_SECONDS,
} from "./platform-session-types";
import { resolveSessionCookieSecure } from "@app-tour/session-client";

export {
  PLATFORM_SESSION_COOKIE,
  PLATFORM_SESSION_MAX_AGE_SECONDS,
  type PlatformOpsSessionPayload,
} from "./platform-session-types";

export function buildPlatformSessionCookieHeader(sessionToken: string): string {
  const parts = [
    `${PLATFORM_SESSION_COOKIE}=${sessionToken}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${PLATFORM_SESSION_MAX_AGE_SECONDS}`,
  ];
  if (resolveSessionCookieSecure()) {
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
  if (resolveSessionCookieSecure()) {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export { parsePlatformSession, validatePlatformSessionToken } from "./validate-platform-session-token";
