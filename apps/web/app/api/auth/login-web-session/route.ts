import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";

type LoginPayload = {
  phone?: unknown;
  otp?: unknown;
  invite_token?: unknown;
};

function resolveBackendUrl(): string {
  return process.env.TOUR_OPS_API_URL?.trim() || "http://denali.localhost:3001";
}

function secureCookieEnabled(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as LoginPayload;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const inviteToken = typeof body.invite_token === "string" ? body.invite_token.trim() : undefined;
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "c19782"
    },
    body: JSON.stringify({
      sessionId: "c19782",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "app/api/auth/login-web-session/route.ts:23",
      message: "login_bridge_enter",
      data: {
        has_phone: phone.length > 0,
        otp_length: otp.length,
        incoming_host: req.headers.get("host") ?? ""
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  if (!phone || !otp) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "phone and otp are required" } },
      { status: 400 }
    );
  }

  const backendRes = await fetch(`${resolveBackendUrl()}/api/v2/auth/web/session/otp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: req.headers.get("host") ?? ""
    },
    body: JSON.stringify({ phone, otp, ...(inviteToken ? { invite_token: inviteToken } : {}) }),
    cache: "no-store"
  }).catch(() => null);

  if (!backendRes) {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend login unavailable" } },
      { status: 502 }
    );
  }

  const backendBody = (await backendRes.json().catch(() => ({}))) as {
    session_token?: unknown;
    requires_registration?: unknown;
    onboarding_token?: unknown;
    user_id?: unknown;
    tenant_id?: unknown;
    error?: { code?: string; message?: string };
  };
  const sessionToken =
    typeof backendBody.session_token === "string" ? backendBody.session_token.trim() : "";
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "c19782"
    },
    body: JSON.stringify({
      sessionId: "c19782",
      runId: "pre-fix",
      hypothesisId: "H2",
      location: "app/api/auth/login-web-session/route.ts:56",
      message: "login_bridge_backend_result",
      data: {
        backend_status: backendRes.status,
        backend_ok: backendRes.ok,
        has_session_token: sessionToken.length > 0,
        backend_error_code: backendBody.error?.code ?? null
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion

  const requiresRegistration = backendBody.requires_registration === true;
  const onboardingToken =
    typeof backendBody.onboarding_token === "string" ? backendBody.onboarding_token.trim() : "";
  if (requiresRegistration && onboardingToken) {
    return NextResponse.json(
      {
        ok: true,
        requires_registration: true,
        onboarding_token: onboardingToken
      },
      { status: 200 }
    );
  }

  if (!backendRes.ok || !sessionToken) {
    const backendErrorCode = backendBody.error?.code ?? "AUTH_FAILED";
    const backendMessage = backendBody.error?.message ?? "Invalid phone or OTP";
    console.error("auth_login_web_session_backend_error", {
      status: backendRes.status,
      body: backendBody
    });
    const status =
      backendErrorCode === "AUTH_NO_ACTIVE_MEMBERSHIP"
        ? 200
        : backendRes.status >= 400
          ? backendRes.status
          : 401;
    return NextResponse.json(
      {
        ok: false,
        error_code: backendErrorCode,
        message: backendMessage
      },
      { status }
    );
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set({
    name: SESSION_TOKEN_COOKIE,
    value: sessionToken,
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: secureCookieEnabled()
  });
  // #region agent log
  fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "c19782"
    },
    body: JSON.stringify({
      sessionId: "c19782",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "app/api/auth/login-web-session/route.ts:87",
      message: "login_bridge_cookie_set",
      data: {
        cookie_name: SESSION_TOKEN_COOKIE,
        cookie_http_only: true,
        cookie_same_site: "lax",
        cookie_secure: secureCookieEnabled()
      },
      timestamp: Date.now()
    })
  }).catch(() => {});
  // #endregion
  return response;
}
