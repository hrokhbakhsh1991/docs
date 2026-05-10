import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { normalizeOtpPhoneInput } from "@/lib/otp-phone-normalize";

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
  const phone =
    typeof body.phone === "string" ? normalizeOtpPhoneInput(body.phone) : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const inviteToken = typeof body.invite_token === "string" ? body.invite_token.trim() : undefined;
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
  return response;
}
