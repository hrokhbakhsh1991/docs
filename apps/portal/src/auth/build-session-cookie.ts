import { isLocalhostIngressHost } from "@app-tour/guest-surface-host";
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
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost";
  const domain = resolveMemberSessionCookieDomain(host, rootDomain);
  if (domain !== undefined) {
    return { domain };
  }
  // PCMS-COOK-02 — localhost ingress always shares via Domain=localhost (not NODE_ENV-gated).
  // Safe for production: real prod hosts never use *.localhost (WRS §3.3).
  if (isLocalhostIngressHost(host)) {
    return { domain: "localhost" };
  }
  return undefined;
}

export function shouldRefreshDevMemberSessionCookieDomain(host: string): boolean {
  return isLocalhostIngressHost(host);
}

export function setSessionCookieOnResponse(
  headers: Headers,
  token: string,
  host?: string
): void {
  helpers.setSessionCookieOnResponse(headers, token, resolveCookieWriteOptions(host));
}

export function clearSessionCookieOnResponse(headers: Headers, host?: string): void {
  // Host-only clear — legacy cookies written before Domain= was applied.
  helpers.clearSessionCookieOnResponse(headers, undefined);
  const domainOptions = resolveCookieWriteOptions(host);
  if (domainOptions?.domain !== undefined && domainOptions.domain.length > 0) {
    helpers.clearSessionCookieOnResponse(headers, domainOptions);
  }
}

export function resolveMemberSessionCookieDomainForHost(host: string): string | undefined {
  return resolveMemberSessionCookieDomain(
    host,
    process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost"
  );
}
