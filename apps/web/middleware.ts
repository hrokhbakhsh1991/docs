import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { decodeJwtPayload } from "./lib/auth/decode-jwt-payload";

/** Must stay aligned with `SESSION_TOKEN_COOKIE` in `lib/auth/session.ts` (avoid importing `session.ts` in Edge — it pulls `js-cookie`). */
const SESSION_TOKEN_COOKIE = "tour_ops_session";

function isLeaderRole(role: string | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return r === "owner" || r === "admin";
}

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

function isLeaderOnlyRoute(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname === "/dashboard/") return true;
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

  if (isLeaderOnlyRoute(pathname) && !isLeaderRole(role)) {
    const forbiddenUrl = request.nextUrl.clone();
    forbiddenUrl.pathname = "/403";
    forbiddenUrl.search = "";
    return NextResponse.redirect(forbiddenUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|.*\\..*).*)"],
};
