import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "./lib/auth/session-cookie";
import { routing } from "./src/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/** Prefixes from the old multi-locale router; redirect to the new locale-less paths. */
const LEGACY_LOCALE_PREFIXES = ["/fa", "/en"] as const;

/**
 * 1) Strip legacy `/fa` / `/en` URL prefixes (308).
 * 2) `next-intl` middleware (single locale, no path prefix).
 * 3) Session gate on the final pathname (always locale-less).
 */
function stripLegacyLocalePrefix(pathname: string): string | null {
  for (const prefix of LEGACY_LOCALE_PREFIXES) {
    if (pathname === prefix) {
      return "/";
    }
    if (pathname.startsWith(`${prefix}/`)) {
      const next = pathname.slice(prefix.length);
      return next === "" ? "/" : next;
    }
  }
  return null;
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/auth/login") ||
    pathname.startsWith("/auth/register") ||
    pathname.startsWith("/auth/invite")
  );
}

export default function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const legacyTarget = stripLegacyLocalePrefix(pathname);
  if (legacyTarget !== null) {
    const url = request.nextUrl.clone();
    url.pathname = legacyTarget;
    return NextResponse.redirect(url, 308);
  }

  const intlResponse = intlMiddleware(request);
  if (intlResponse.status >= 300 && intlResponse.status < 400) {
    return intlResponse;
  }

  if (pathname.startsWith("/static")) {
    return NextResponse.next();
  }

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_TOKEN_COOKIE)?.value;

  if (!token || !token.trim()) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
