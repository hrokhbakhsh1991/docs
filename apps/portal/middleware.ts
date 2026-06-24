import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  SESSION_TOKEN_COOKIE,
  clearSessionCookieOnResponse,
} from "@/auth/build-session-cookie";
import { validateSessionToken } from "@app-tour/session-client";
import { sessionTenantMatchesHost } from "@/tenant/session-host-binding";

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

function redirectHome(request: NextRequest, clearCookie: boolean): NextResponse {
  const home = request.nextUrl.clone();
  home.pathname = "/";
  home.search = "";
  const response = NextResponse.redirect(home);
  if (clearCookie) {
    clearSessionCookieOnResponse(response.headers);
  }
  return response;
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") ?? "";

  if (!isProtectedMemberPath(pathname)) {
    return forwardPathname(request, pathname);
  }

  const token = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;
  const validation = validateSessionToken(token);

  if (validation.status === "valid") {
    if (!sessionTenantMatchesHost(validation.tenantId, host)) {
      if (pathname.startsWith("/api/me/")) {
        const res = jsonAuthError(
          403,
          "AUTH_TENANT_HOST_MISMATCH",
          "Session tenant does not match workspace host"
        );
        clearSessionCookieOnResponse(res.headers);
        return res;
      }
      return redirectHome(request, true);
    }
    return forwardPathname(request, pathname);
  }

  if (pathname.startsWith("/api/me/")) {
    return jsonAuthError(401, "AUTH_UNAUTHENTICATED", "Authentication required");
  }

  return redirectHome(request, Boolean(token?.trim()));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
