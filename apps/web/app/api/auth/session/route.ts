import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { decodeJwtPayload } from "@/lib/auth/decode-jwt-payload";
import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

function secureCookieEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

function clearCookie(response: NextResponse): NextResponse {
  response.cookies.set({
    name: SESSION_TOKEN_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "strict",
    secure: secureCookieEnabled(),
    expires: new Date(0)
  });
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
  const payload = {
    authenticated: true,
    session_token: token,
    user_id: userId,
    tenant_id: tenantId
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
    tenant_id: tenantId
  });
  response.cookies.set({
    name: SESSION_TOKEN_COOKIE,
    value: token,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled()
  });
  return response;
}

export async function DELETE(): Promise<NextResponse> {
  return clearCookie(NextResponse.json({ ok: true }, { status: 200 }));
}
