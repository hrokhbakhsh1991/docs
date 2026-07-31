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

function resolveCustomApexCookieDomain(host: string): SessionCookieWriteOptions | undefined {
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost";
  const domain = resolveMemberSessionCookieDomain(host, rootDomain);
  if (domain !== undefined) {
    return { domain };
  }
  return undefined;
}

/**
 * Auth BFF — Domain=<share-parent> on custom apex and portal.{club}.localhost;
 * host-only on legacy {club}.portal.localhost.
 */
function resolveInitialCookieWriteOptions(host?: string): SessionCookieWriteOptions | undefined {
  if (!host?.trim()) {
    return undefined;
  }
  return resolveCustomApexCookieDomain(host);
}

/**
 * Middleware refresh + logout clear — PCMS-COOK-03.
 * Never Domain=.localhost / Domain=localhost (PSL / Chromium reject).
 */
function resolveSharedCookieWriteOptions(host?: string): SessionCookieWriteOptions | undefined {
  if (!host?.trim()) {
    return undefined;
  }
  return resolveCustomApexCookieDomain(host);
}

/** True when cookie Domain=<share-parent> should be (re-)issued for this ingress. */
export function shouldRefreshDevMemberSessionCookieDomain(host: string): boolean {
  return resolveCustomApexCookieDomain(host) !== undefined;
}

export type SetSessionCookieMode = "initial" | "shared";

export function setSessionCookieOnResponse(
  headers: Headers,
  token: string,
  host?: string,
  mode: SetSessionCookieMode = "initial"
): void {
  const writeOptions =
    mode === "shared"
      ? resolveSharedCookieWriteOptions(host)
      : resolveInitialCookieWriteOptions(host);
  helpers.setSessionCookieOnResponse(headers, token, writeOptions);
}

export function clearSessionCookieOnResponse(headers: Headers, host?: string): void {
  // Host-only clear — legacy cookies written before Domain= was applied.
  helpers.clearSessionCookieOnResponse(headers, undefined);
  const domainOptions = resolveSharedCookieWriteOptions(host);
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
