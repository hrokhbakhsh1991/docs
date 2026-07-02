import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const LOCALE_HEADER = "x-marketing-locale";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
    requestHeaders.set(LOCALE_HEADER, "en");
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  requestHeaders.set(LOCALE_HEADER, "fa");
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
