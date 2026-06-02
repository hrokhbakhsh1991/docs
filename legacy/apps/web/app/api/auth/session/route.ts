import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  clearAllSessionCookiesOnResponse,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  setSessionCookieOnResponse,
} from "@/lib/auth/build-session-cookie";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { pickSessionTokenFromRequestCookies } from "@/lib/auth/resolve-session-cookie";
import { validateSessionToken } from "@/lib/auth/validate-session-token";

function clearCookie(response: NextResponse): NextResponse {
  clearAllSessionCookiesOnResponse(response);
  return response;
}

export async function GET(): Promise<NextResponse> {
  const picked = pickSessionTokenFromRequestCookies(cookies());
  if (!picked || picked.validation.status !== "valid") {
    if (picked?.token.trim()) {
      return clearCookie(NextResponse.json({ authenticated: false }, { status: 200 }));
    }
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const { token: sessionToken, validation } = picked;
  const role = validation.role;
  const response = NextResponse.json({
    authenticated: true,
    session_token: sessionToken,
    user_id: validation.userId,
    tenant_id: validation.tenantId,
    /** Client `useAuth` prefers this shape; keeps leader gates working when JWT carries `role`. */
    user: { userId: validation.userId, tenantId: validation.tenantId, role },
  });
  /** Consolidate to a single host-only cookie and drop stale duplicates after refresh. */
  setSessionCookieOnResponse(response, {
    token: sessionToken,
    maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { session_token?: unknown };
  const cookieToken = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim() ?? "";
  const token = typeof body.session_token === "string" ? body.session_token.trim() : cookieToken;
  const validation = validateSessionToken(token);
  if (validation.status !== "valid") {
    if (token) {
      return clearCookie(NextResponse.json({ authenticated: false }, { status: 200 }));
    }
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const response = NextResponse.json({
    authenticated: true,
    session_token: token,
    user_id: validation.userId,
    tenant_id: validation.tenantId,
  });
  setSessionCookieOnResponse(response, {
    token,
    maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  return clearCookie(NextResponse.json({ ok: true }, { status: 200 }));
}
