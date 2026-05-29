import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/build-session-cookie";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { validateSessionToken } from "@/lib/auth/validate-session-token";

function clearCookie(response: NextResponse): NextResponse {
  response.cookies.set(buildClearSessionCookieOptions());
  return response;
}

export async function GET(): Promise<NextResponse> {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value;
  const validation = validateSessionToken(token);
  if (validation.status !== "valid") {
    if (token?.trim()) {
      return clearCookie(NextResponse.json({ authenticated: false }, { status: 200 }));
    }
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }

  const sessionToken = token?.trim() ?? "";
  const role = validation.role;
  const payload = {
    authenticated: true,
    session_token: sessionToken,
    user_id: validation.userId,
    tenant_id: validation.tenantId,
    /** Client `useAuth` prefers this shape; keeps leader gates working when JWT carries `role`. */
    user: { userId: validation.userId, tenantId: validation.tenantId, role },
  };
  return NextResponse.json(payload);
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
  response.cookies.set(
    buildSessionCookieOptions({ token, maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS }),
  );
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  return clearCookie(NextResponse.json({ ok: true }, { status: 200 }));
}
