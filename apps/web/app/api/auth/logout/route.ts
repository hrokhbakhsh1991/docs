import { NextResponse } from "next/server";

import { clearSessionCookieOnResponse, SESSION_TOKEN_COOKIE } from "@/auth/build-session-cookie";
import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { clearOperatorWelcomeArmedCookieOnResponse } from "@/auth/operator-welcome-cookie";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";
import { readSessionTokenFromCookieHeader } from "@app-tour/session-client";

export async function POST(request: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromCookieHeader(
    request.headers.get("cookie") ?? "",
    SESSION_TOKEN_COOKIE
  );
  let sessionRevoked = true;
  if (sessionToken !== undefined) {
    try {
      const response = await operatorApiFetch(
        `${resolveTourOpsApiBaseUrl()}/auth/end-platform-impersonation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionToken }),
          cache: "no-store",
          signal: AbortSignal.timeout(5_000),
        }
      );
      // A rejected token is already unusable; only upstream failures must retain the cookie.
      sessionRevoked = response.ok || response.status === 401;
    } catch {
      sessionRevoked = false;
    }
  }
  const res = NextResponse.json(
    sessionRevoked
      ? { ok: true }
      : { ok: false, error: { code: "SUPPORT_SESSION_REVOCATION_FAILED" } },
    { status: sessionRevoked ? 200 : 503 }
  );
  if (!sessionRevoked) {
    clearOperatorWelcomeArmedCookieOnResponse(res.headers);
    return res;
  }
  clearSessionCookieOnResponse(res.headers);
  clearOperatorWelcomeArmedCookieOnResponse(res.headers);
  return res;
}
