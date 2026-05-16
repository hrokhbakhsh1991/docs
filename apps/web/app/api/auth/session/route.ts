import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import {
  buildClearSessionCookieOptions,
  buildSessionCookieOptions,
} from "@/lib/auth/build-session-cookie";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

function clearCookie(response: NextResponse): NextResponse {
  response.cookies.set(buildClearSessionCookieOptions());
  return response;
}

export async function GET(): Promise<NextResponse> {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  const claims = decodeJwtPayload(token);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : undefined;
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : undefined;
  if (!userId || !tenantId) {
    return clearCookie(NextResponse.json({ authenticated: false }, { status: 200 }));
  }
  const role = typeof claims?.role === "string" ? claims.role.trim() : undefined;
  const payload = {
    authenticated: true,
    session_token: token,
    user_id: userId,
    tenant_id: tenantId,
    /** Client `useAuth` prefers this shape; keeps leader gates working when JWT carries `role`. */
    user: { userId, tenantId, role },
  };
  return NextResponse.json(payload);
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as { session_token?: unknown };
  const cookieToken = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim() ?? "";
  const token = typeof body.session_token === "string" ? body.session_token.trim() : cookieToken;
  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 200 });
  }
  const claims = decodeJwtPayload(token);
  const userId = typeof claims?.sub === "string" ? claims.sub.trim() : undefined;
  const tenantId = typeof claims?.tenant_id === "string" ? claims.tenant_id.trim() : undefined;
  if (!userId || !tenantId) {
    return clearCookie(NextResponse.json({ authenticated: false }, { status: 200 }));
  }
  const response = NextResponse.json({
    authenticated: true,
    session_token: token,
    user_id: userId,
    tenant_id: tenantId,
  });
  response.cookies.set(buildSessionCookieOptions({ token }));
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  return clearCookie(NextResponse.json({ ok: true }, { status: 200 }));
}
