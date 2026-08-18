import { NextResponse } from "next/server";

import { resolvePortalMemberLoginPath } from "@app-tour/guest-surface-host";

import { clearSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { isSafePortalReturnPath } from "@/auth/is-safe-portal-return-path";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export const dynamic = "force-dynamic";

/** PCMS-SEC-03 — clear dead `atour_mb_session` then send the browser to member login. */
export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const requestUrl = new URL(req.url);
  const portalReturnRaw = requestUrl.searchParams.get("portalReturn");
  const returnPath = isSafePortalReturnPath(portalReturnRaw) ? portalReturnRaw.trim() : undefined;
  const loginPath =
    resolvePortalMemberLoginPath(host, returnPath) ??
    "/login?portalReturn=%2Fme%2Fregistrations";

  const parsed = new URL(loginPath, requestUrl.origin);
  const target = new URL(requestUrl.href);
  target.pathname = parsed.pathname;
  target.search = parsed.search;
  target.hash = "";
  const response = NextResponse.redirect(target, 307);
  response.headers.set("Cache-Control", "no-store");
  clearSessionCookieOnResponse(response.headers, host);
  return response;
}
