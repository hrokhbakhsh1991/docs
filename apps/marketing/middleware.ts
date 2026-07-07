import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { MARKETING_HEADER_OVERLAY_REQUEST_HEADER, isMarketingHomePath } from "@/shell/resolve-marketing-header-overlay";

const LOCALE_HEADER = "x-marketing-locale";

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);

  if (isMarketingHomePath(pathname)) {
    requestHeaders.set(MARKETING_HEADER_OVERLAY_REQUEST_HEADER, "1");
  } else {
    requestHeaders.delete(MARKETING_HEADER_OVERLAY_REQUEST_HEADER);
  }

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
