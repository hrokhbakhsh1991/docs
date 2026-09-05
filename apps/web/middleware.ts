import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  OPERATOR_LOGIN_ALIAS_PATH,
  OPERATOR_LOGIN_PATH,
  OPERATOR_WIZARD_PATH,
} from "@/admin/require-operator-session";
import { resolveOperatorAdminRootRedirect } from "@/admin/resolve-operator-admin-root-redirect";
import {
  SESSION_TOKEN_COOKIE,
  clearSessionCookieOnResponse,
} from "@/auth/build-session-cookie";
import { validateSessionToken } from "@app-tour/session-client";
import {
  PLATFORM_SESSION_COOKIE,
  validatePlatformSessionToken,
} from "@/platform/build-platform-session-cookie";
import { isPlatformAdminHost } from "@/platform/is-platform-admin-host";
import { parseMultiLevelTenantHost, toCanonicalClubAdminHost } from "@app-tour/tenant-kernel/host-only";
import { resolveClubApexToAdminRedirect } from "@/tenant/resolve-club-apex-to-admin-redirect";
import { isOperatorAdminIngressHost } from "@/tenant/operator-admin-host";
import {
  allowsOperatorTicketsTeamRole,
  isOperatorTicketsTeamAccessPath,
} from "@/features/tickets/resolve-operator-tickets-middleware-access";
import {
  allowsOperatorToursTeamRole,
  isOperatorToursTeamAccessPath,
} from "@/features/tours/resolve-operator-tours-middleware-access";
import {
  allowsOperatorEngagementTeamRole,
  isOperatorEngagementTeamAccessPath,
} from "@/engagement/resolve-operator-engagement-middleware-access";
import { isDevWebSessionAllowed } from "@/tenant/auth-env";
import {
  normalizeHostHeader,
  readPlatformRootDomainWeb,
  readWebReservedHostLabels,
} from "@/tenant/platform-host-env";
import { isPlatformPublicPath } from "@/platform/require-platform-ops-session";
import { shouldBypassMiddlewareForDevE2eHost } from "@/tenant/resolve-dev-e2e-host-bypass";
import { sessionTenantMatchesHost } from "@/tenant/session-host-binding";

const ADMIN_PATH_PREFIXES = [
  "/dashboard",
  "/users",
  "/bookings",
  "/tickets",
  "/settings",
  "/finance",
  "/leader",
  "/tours",
] as const;

function isPublicPath(pathname: string): boolean {
  return (
    pathname === OPERATOR_LOGIN_ALIAS_PATH ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/catalog") ||
    pathname === "/workspace-host-probe" ||
    pathname === "/"
  );
}

/** BFF routes that must not require a session (operator login flow). */
const PUBLIC_BFF_API_PATHS = [
  "/api/auth/phone-preflight",
  "/api/auth/request-otp",
  "/api/auth/login-web-session",
  "/api/auth/login-team-web-session",
  "/api/auth/logout",
  "/api/public/tenant-branding",
  "/api/debug/host",
] as const;

function isPublicBffApiPath(pathname: string): boolean {
  return PUBLIC_BFF_API_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );
}

function isProtectedBffApiPath(pathname: string): boolean {
  return pathname.startsWith("/api/") && !isPublicBffApiPath(pathname);
}

function isProtectedAdminPath(pathname: string): boolean {
  if (pathname === OPERATOR_WIZARD_PATH) {
    return true;
  }
  return ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function isProtectedPath(pathname: string): boolean {
  return isProtectedAdminPath(pathname) || isProtectedBffApiPath(pathname);
}

function readSessionToken(request: NextRequest): string | undefined {
  return request.cookies.get(SESSION_TOKEN_COOKIE)?.value;
}

function redirectToLogin(
  request: NextRequest,
  clearCookie: boolean,
  accessReason?: "tenant-mismatch" | "owner-only"
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = OPERATOR_LOGIN_PATH;
  const returnUrl = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const params = new URLSearchParams({ returnUrl });
  if (accessReason !== undefined) {
    params.set("access", accessReason);
  }
  loginUrl.search = params.toString();
  const response = NextResponse.redirect(loginUrl);
  if (clearCookie) {
    clearSessionCookieOnResponse(response.headers);
  }
  return response;
}

function jsonAuthError(status: number, code: string, message: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message } }, { status });
}

function forwardPathname(request: NextRequest, pathname: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

function isPlatformPublicBffPath(pathname: string): boolean {
  return (
    pathname === "/api/platform/auth/login" ||
    pathname === "/api/platform/auth/request-otp" ||
    pathname === "/api/platform/auth/logout"
  );
}

function isPlatformProtectedPath(pathname: string): boolean {
  return pathname.startsWith("/platform") || pathname.startsWith("/api/platform/");
}

function redirectToPlatformLogin(request: NextRequest): NextResponse {
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/auth/login";
  loginUrl.search = new URLSearchParams({
    returnUrl: `${request.nextUrl.pathname}${request.nextUrl.search}`,
  }).toString();
  return NextResponse.redirect(loginUrl);
}

async function handlePlatformAdminHost(request: NextRequest, host: string): Promise<NextResponse | null> {
  if (!isPlatformAdminHost(host)) {
    return null;
  }

  const { pathname } = request.nextUrl;
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/platform", request.url));
  }

  if (isProtectedAdminPath(pathname)) {
    return NextResponse.redirect(new URL("/platform", request.url));
  }

  const isPublic =
    isPlatformPublicPath(pathname) ||
    isPlatformPublicBffPath(pathname) ||
    isPublicBffApiPath(pathname);

  if (!isPlatformProtectedPath(pathname)) {
    return forwardPathname(request, pathname);
  }

  if (isPublic) {
    return forwardPathname(request, pathname);
  }

  const validation = await validatePlatformSessionToken(
    request.cookies.get(PLATFORM_SESSION_COOKIE)?.value
  );
  if (validation.status === "valid") {
    return forwardPathname(request, pathname);
  }

  if (pathname.startsWith("/api/platform/")) {
    return jsonAuthError(401, "PLATFORM_UNAUTHORIZED", "Platform session required");
  }

  return redirectToPlatformLogin(request);
}

function notFoundResponse(): NextResponse {
  return new NextResponse("Not Found", { status: 404 });
}

function blockPlatformOnClubAdminHost(request: NextRequest, host: string): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/platform")) {
    return null;
  }
  if (
    parseMultiLevelTenantHost(
      normalizeHostHeader(host),
      readPlatformRootDomainWeb(),
      readWebReservedHostLabels()
    ).kind === "club_admin"
  ) {
    return notFoundResponse();
  }
  return null;
}

function blockOperatorOnWrongHost(request: NextRequest, host: string): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (!isProtectedAdminPath(pathname)) {
    return null;
  }
  if (isPlatformAdminHost(host)) {
    return NextResponse.redirect(new URL("/platform", request.url));
  }
  if (!isOperatorAdminIngressHost(host)) {
    return notFoundResponse();
  }
  return null;
}

function redirectLegacyClubAdminHostIfNeeded(request: NextRequest, host: string): NextResponse | null {
  const canonical = toCanonicalClubAdminHost(host, readPlatformRootDomainWeb(), readWebReservedHostLabels());
  if (canonical === null) {
    return null;
  }

  const target = request.nextUrl.clone();
  target.host = canonical;
  return NextResponse.redirect(target, 308);
}

function preservesTeamPanelSession(role: string | undefined): boolean {
  return role === "viewer" || role === "admin";
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? request.nextUrl.host ?? "";

  const platformResponse = await handlePlatformAdminHost(request, host);
  if (platformResponse !== null) {
    return platformResponse;
  }

  const legacyAdminRedirect = redirectLegacyClubAdminHostIfNeeded(request, host);
  if (legacyAdminRedirect !== null) {
    return legacyAdminRedirect;
  }

  const clubApexAdminRedirect = resolveClubApexToAdminRedirect({
    host,
    pathname,
    search: request.nextUrl.search,
  });
  if (clubApexAdminRedirect !== null) {
    return NextResponse.redirect(new URL(clubApexAdminRedirect), 308);
  }

  const operatorAdminHome = resolveOperatorAdminRootRedirect({ pathname, host });
  if (operatorAdminHome !== null) {
    return NextResponse.redirect(new URL(operatorAdminHome, request.url));
  }

  const platformOnClubAdmin = blockPlatformOnClubAdminHost(request, host);
  if (platformOnClubAdmin !== null) {
    return platformOnClubAdmin;
  }

  const operatorHostGate = blockOperatorOnWrongHost(request, host);
  if (operatorHostGate !== null) {
    return operatorHostGate;
  }

  const isBffApi = isProtectedBffApiPath(pathname);

  if (!isProtectedPath(pathname) || isPublicPath(pathname)) {
    return forwardPathname(request, pathname);
  }

  if (shouldBypassMiddlewareForDevE2eHost(host)) {
    return forwardPathname(request, pathname);
  }

  const token = readSessionToken(request);
  const validation = validateSessionToken(token);
  if (validation.status === "valid") {
    if (!sessionTenantMatchesHost(validation.tenantId, host)) {
      if (isBffApi) {
        const res = jsonAuthError(
          403,
          "AUTH_TENANT_HOST_MISMATCH",
          "Session tenant does not match workspace host"
        );
        clearSessionCookieOnResponse(res.headers);
        return res;
      }
      return redirectToLogin(request, true, "tenant-mismatch");
    }
    if (validation.role !== "owner") {
      if (
        isDevWebSessionAllowed() &&
        isOperatorTicketsTeamAccessPath(pathname) &&
        allowsOperatorTicketsTeamRole(validation.role, request.method)
      ) {
        return forwardPathname(request, pathname);
      }
      if (
        isDevWebSessionAllowed() &&
        isOperatorToursTeamAccessPath(pathname) &&
        allowsOperatorToursTeamRole(validation.role, request.method)
      ) {
        return forwardPathname(request, pathname);
      }
      if (
        isDevWebSessionAllowed() &&
        isOperatorEngagementTeamAccessPath(pathname) &&
        allowsOperatorEngagementTeamRole(validation.role, request.method)
      ) {
        return forwardPathname(request, pathname);
      }
      if (isBffApi) {
        const res = jsonAuthError(
          403,
          "AUTH_OWNER_PANEL_ONLY",
          "Owner role required for this panel"
        );
        if (!preservesTeamPanelSession(validation.role)) {
          clearSessionCookieOnResponse(res.headers);
        }
        return res;
      }
      return redirectToLogin(
        request,
        !preservesTeamPanelSession(validation.role),
        "owner-only",
      );
    }
    return forwardPathname(request, pathname);
  }

  if (isBffApi) {
    return jsonAuthError(401, "AUTH_UNAUTHENTICATED", "Authentication required");
  }

  return redirectToLogin(request, Boolean(token?.trim()));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
