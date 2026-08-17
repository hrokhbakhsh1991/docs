import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { resolvePortalMemberLoginPath, resolvePublicAuthCorsAllowOrigin } from "@app-tour/guest-surface-host";
import { toCanonicalClubPortalHost } from "@app-tour/tenant-kernel";
import { validateSessionTokenAsync } from "@app-tour/session-client";

import {
  SESSION_TOKEN_COOKIE,
  clearSessionCookieOnResponse,
  setSessionCookieOnResponse,
  shouldRefreshDevMemberSessionCookieDomain,
} from "@/auth/build-session-cookie";
import {
  applyPublicAuthCorsHeaders,
  isPortalPublicAuthApiPath,
} from "@/auth/apply-public-auth-cors";
import { isDevWebSessionAllowed } from "@/tenant/auth-env";
import { sessionTenantMatchesHost } from "@/tenant/session-host-binding";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

function isProtectedMemberPath(pathname: string): boolean {
  return pathname === "/me" || pathname.startsWith("/me/") || pathname.startsWith("/api/me/");
}

function forwardPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function jsonAuthError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function redirectHome(request: NextRequest, clearCookie: boolean, host: string): NextResponse {
  const home = request.nextUrl.clone();
  home.pathname = "/";
  home.search = "";
  const response = NextResponse.redirect(home);
  if (clearCookie) {
    clearSessionCookieOnResponse(response.headers, host);
  }
  return response;
}

function redirectToMemberLogin(
  request: NextRequest,
  clearCookie: boolean,
  host: string
): NextResponse {
  const returnPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const loginPath =
    resolvePortalMemberLoginPath(host, returnPath) ??
    resolvePortalMemberLoginPath(host) ??
    "/";
  const parsed = new URL(loginPath, request.nextUrl.origin);
  const target = request.nextUrl.clone();
  target.pathname = parsed.pathname;
  target.search = parsed.search;
  const response = NextResponse.redirect(target);
  if (clearCookie) {
    clearSessionCookieOnResponse(response.headers, host);
  }
  return response;
}

async function resolvePortalTenantIdForHost(host: string): Promise<string | null> {
  try {
    const bootstrap = await resolvePortalBootstrapForHost(host);
    return bootstrap.tenantId;
  } catch {
    return null;
  }
}

/** PCMS-COOK-05 — 308 legacy `{club}.portal.localhost` → `portal.{club}.localhost` before auth. */
function redirectLegacyClubPortalHostIfNeeded(request: NextRequest): NextResponse | null {
  const host = resolvePortalIngressHost(request);
  const rootDomain = process.env.PLATFORM_ROOT_DOMAIN?.trim() || "localhost";
  const canonical = toCanonicalClubPortalHost(host, rootDomain);
  if (canonical === null) {
    return null;
  }

  const target = request.nextUrl.clone();
  target.host = canonical;
  return NextResponse.redirect(target, 308);
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const legacyRedirect = redirectLegacyClubPortalHostIfNeeded(request);
  if (legacyRedirect !== null) {
    return legacyRedirect;
  }

  const { pathname } = request.nextUrl;
  const host = resolvePortalIngressHost(request);
  const publicAuthCorsOrigin = isPortalPublicAuthApiPath(pathname)
    ? resolvePublicAuthCorsAllowOrigin({
        ingressHost: host,
        originHeader: request.headers.get("origin"),
      })
    : null;

  if (request.method === "OPTIONS" && isPortalPublicAuthApiPath(pathname)) {
    const preflight = new NextResponse(null, {
      status: publicAuthCorsOrigin !== null ? 204 : 403,
    });
    if (publicAuthCorsOrigin !== null) {
      applyPublicAuthCorsHeaders(preflight.headers, publicAuthCorsOrigin);
    }
    return preflight;
  }

  const token = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;
  const validation = await validateSessionTokenAsync(token);

  let response: NextResponse;

  if (!isProtectedMemberPath(pathname)) {
    response = forwardPathname(request, pathname);
  } else {
    const resolvedPortalTenantId = await resolvePortalTenantIdForHost(host);
    const failClosedWhenUnresolved = !isDevWebSessionAllowed();

    if (validation.status === "valid") {
      if (
        !sessionTenantMatchesHost(validation.tenantId, host, {
          resolvedPortalTenantId,
          failClosedWhenUnresolved,
        })
      ) {
        if (pathname.startsWith("/api/me/")) {
          const res = jsonAuthError(
            403,
            "AUTH_TENANT_HOST_MISMATCH",
            "Session tenant does not match workspace host"
          );
          clearSessionCookieOnResponse(res.headers, host);
          return res;
        }
        return redirectHome(request, true, host);
      }
      response = forwardPathname(request, pathname);
    } else if (pathname.startsWith("/api/me/")) {
      if (validation.status === "invalid_signature") {
        const res = jsonAuthError(401, "AUTH_INVALID_TOKEN", "Session token signature invalid");
        clearSessionCookieOnResponse(res.headers, host);
        return res;
      }
      return jsonAuthError(401, "AUTH_UNAUTHENTICATED", "Authentication required");
    } else {
      response = redirectToMemberLogin(
        request,
        Boolean(token?.trim()) || validation.status === "invalid_signature",
        host
      );
    }
  }

  if (
    validation.status === "valid" &&
    typeof token === "string" &&
    token.trim().length > 0 &&
    shouldRefreshDevMemberSessionCookieDomain(host)
  ) {
    setSessionCookieOnResponse(response.headers, token.trim(), host, "shared");
  }

  if (publicAuthCorsOrigin !== null) {
    applyPublicAuthCorsHeaders(response.headers, publicAuthCorsOrigin);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
