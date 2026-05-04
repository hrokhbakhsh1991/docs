import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { decodeJwtPayload } from "./lib/auth/decode-jwt-payload";
import { canAccessLeaderReview } from "./lib/auth/routeRolePolicy";
import { isLeaderRole, isParticipantRole } from "./lib/auth/role-tags";
import { SESSION_TOKEN_COOKIE } from "./lib/auth/session-cookie";

function hydrateRoleFromToken(token: string): string | undefined {
  // Protects against corrupted or tampered cookies that decodeJwtPayload does not fully validate
  try {
    const claims = decodeJwtPayload(token);
    const userId = typeof claims?.sub === "string" ? claims.sub.trim() : "";
    const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : "";
    if (!userId || !tenantId) {
      return undefined;
    }
    return typeof claims?.role === "string" ? claims.role.trim() : undefined;
  } catch {
    return undefined;
  }
}

function splitPathSegments(pathname: string): string[] {
  return pathname.split("/").filter(Boolean);
}

function isNumericOrUuid(segment: string): boolean {
  const raw = segment.trim();
  if (!raw) return false;
  if (/^\d+$/.test(raw)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw);
}

function isPublicTourDetailPath(pathname: string): boolean {
  if (!pathname.startsWith("/tours/")) return false;
  const parts = splitPathSegments(pathname);
  if (parts.length !== 2) return false;
  if (parts[0] !== "tours") return false;
  const id = parts[1] ?? "";
  if (id === "new") return false;
  if (id.includes("[") || id.includes("]") || id.includes("...")) return false;
  return isNumericOrUuid(id);
}

/** Paths reachable without a session cookie (participant-style catalogue + auth). */
function isAllowedWithoutToken(pathname: string): boolean {
  if (
    pathname === "/login" ||
    pathname === "/auth/login" ||
    pathname === "/auth/register" ||
    pathname === "/tours" ||
    pathname === "/tours/"
  ) {
    return true;
  }

  if (isPublicTourDetailPath(pathname)) {
    return true;
  }

  const parts = splitPathSegments(pathname);
  if (
    parts.length === 3 &&
    parts[0] === "tours" &&
    parts[2] === "register" &&
    isNumericOrUuid(parts[1] ?? "")
  ) {
    return true;
  }

  return false;
}

function isBookingsParticipantRoute(pathname: string): boolean {
  return pathname === "/bookings" || pathname.startsWith("/bookings/");
}

function isLeaderOnlyRoute(pathname: string): boolean {
  if (pathname === "/tours/new" || pathname === "/tours/new/") return true;
  if (pathname.startsWith("/leader")) return true;
  if (/^\/tours\/[^/]+\/edit(\/.*)?$/.test(pathname)) return true;
  if (/^\/tours\/[^/]+\/workspace(\/.*)?$/.test(pathname)) return true;
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;

  if (!token || !token.trim()) {
    if (isAllowedWithoutToken(pathname)) {
      return NextResponse.next();
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const role = hydrateRoleFromToken(token);
  if (role === undefined) {
    if (isAllowedWithoutToken(pathname)) {
      return NextResponse.next();
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessLeaderReview(role, pathname)) {
    const dashUrl = request.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    dashUrl.search = "";
    return NextResponse.redirect(dashUrl);
  }

  if (isLeaderOnlyRoute(pathname) && !isLeaderRole(role)) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = "/403";
    forbiddenUrl.search = "";
    return NextResponse.redirect(forbiddenUrl);
  }

  if (isBookingsParticipantRoute(pathname) && !isParticipantRole(role)) {
    const dash = request.nextUrl.clone();
    dash.pathname = "/dashboard";
    dash.search = "";
    return NextResponse.redirect(dash);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|.*\\..*).*)"],
};
