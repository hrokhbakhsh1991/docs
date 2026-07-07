import {
  createSessionCookieHelpers,
  SESSION_COOKIE_NAMES,
  type SessionCookieWriteOptions,
} from "@app-tour/session-client";
import { resolveMemberSessionCookieDomain } from "@app-tour/tenant-kernel";

export const SESSION_TOKEN_COOKIE = SESSION_COOKIE_NAMES.member;

const helpers = createSessionCookieHelpers(SESSION_COOKIE_NAMES.member);

export const SESSION_COOKIE_MAX_AGE_SECONDS = helpers.SESSION_COOKIE_MAX_AGE_SECONDS;
export const resolveSessionCookieSecure = helpers.resolveSessionCookieSecure;
export const buildSessionCookieOptions = helpers.buildSessionCookieOptions;

function resolveCookieWriteOptions(host?: string): SessionCookieWriteOptions | undefined {
  if (!host?.trim()) {
    return undefined;
  }
  const domain = resolveMemberSessionCookieDomain(
    host,
    process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost"
  );
  return domain ? { domain } : undefined;
}

export function setSessionCookieOnResponse(
  headers: Headers,
  token: string,
  host?: string
): void {
  helpers.setSessionCookieOnResponse(headers, token, resolveCookieWriteOptions(host));
}

export function clearSessionCookieOnResponse(headers: Headers, host?: string): void {
  helpers.clearSessionCookieOnResponse(headers, resolveCookieWriteOptions(host));
}

export function resolveMemberSessionCookieDomainForHost(host: string): string | undefined {
  return resolveMemberSessionCookieDomain(
    host,
    process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost"
  );
}
