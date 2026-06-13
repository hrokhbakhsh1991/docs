import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  OPERATOR_LOGIN_ALIAS_PATH,
  OPERATOR_LOGIN_PATH,
  OPERATOR_WIZARD_PATH,
} from "@/admin/require-operator-session";
import {
  SESSION_TOKEN_COOKIE,
  clearSessionCookieOnResponse,
} from "@/auth/build-session-cookie";
import { validateSessionToken } from "@/auth/validate-session-token";
import { sessionTenantMatchesHost } from "@/tenant/session-host-binding";

const ADMIN_PATH_PREFIXES = [
  "/dashboard",
  "/users",
  "/bookings",
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
    pathname === "/"
  );
}

/** BFF routes that must not require a session (login flow). */
const PUBLIC_BFF_API_PATHS = [
  "/api/auth/phone-preflight",
  "/api/auth/request-otp",
  "/api/auth/login-web-session",
  "/api/auth/logout",
  "/api/public-auth/phone-preflight",
  "/api/public-auth/request-otp",
  "/api/public-auth/verify-otp",
  "/api/public-auth/register-complete",
  "/api/public-auth/session-profile",
  "/api/public/tenant-branding",
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

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const isBffApi = isProtectedBffApiPath(pathname);

  if (!isProtectedPath(pathname) || isPublicPath(pathname)) {
    return forwardPathname(request, pathname);
  }

  const token = readSessionToken(request);
  const validation = await validateSessionToken(token);
  if (validation.status === "valid") {
    const host = request.headers.get("host") ?? "";
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
      if (isBffApi) {
        const res = jsonAuthError(
          403,
          "AUTH_OWNER_PANEL_ONLY",
          "Owner role required for this panel"
        );
        clearSessionCookieOnResponse(res.headers);
        return res;
      }
      return redirectToLogin(request, true, "owner-only");
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
