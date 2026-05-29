import { NextResponse } from "next/server";

import {
  buildSessionCookieOptions,
  SESSION_COOKIE_MAX_AGE_SECONDS,
} from "@/lib/auth/build-session-cookie";
import { normalizeOtpPhoneInput } from "@/lib/otp-phone-normalize";
import { bffFetch } from "@/lib/api/bff-fetch";
import { bffGuardErrorResponse } from "@/lib/api/bff-error-response";

import { getRequestIdFromHeaders } from "@/lib/api/tracing-utils";

type LoginPayload = {
  phone?: unknown;
  otp?: unknown;
  invite_token?: unknown;
  challenge_id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const requestId = getRequestIdFromHeaders(req.headers);
  const body = (await req.json().catch(() => ({}))) as LoginPayload;
  const phone =
    typeof body.phone === "string" ? normalizeOtpPhoneInput(body.phone) : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const inviteToken = typeof body.invite_token === "string" ? body.invite_token.trim() : undefined;
  const challengeId =
    typeof body.challenge_id === "string" ? body.challenge_id.trim() : undefined;
  if (!phone || !otp) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INVALID_INPUT",
          message: "phone and otp are required",
          ...(requestId ? { requestId } : {}),
        },
      },
      { status: 400 },
    );
  }

  let backendRes: Response;
  try {
    backendRes = await bffFetch(req, "/api/v2/auth/web/session/otp", {
      method: "POST",
      body: JSON.stringify({
        phone,
        otp,
        ...(inviteToken ? { invite_token: inviteToken } : {}),
        ...(challengeId ? { challenge_id: challengeId } : {}),
      }),
    });
  } catch (e) {
    const guard = bffGuardErrorResponse(e, requestId);
    if (guard) {
      return guard;
    }
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "BACKEND_UNREACHABLE",
          message: "Backend login unavailable",
          ...(requestId ? { requestId } : {}),
        },
      },
      { status: 502 },
    );
  }

  const backendBody = (await backendRes.json().catch(() => ({}))) as {
    session_token?: unknown;
    requires_registration?: unknown;
    onboarding_token?: unknown;
    user_id?: unknown;
    tenant_id?: unknown;
    error?: { code?: string; message?: string; details?: Record<string, unknown> };
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
        onboarding_token: onboardingToken,
      },
      { status: 200 },
    );
  }

  if (!backendRes.ok || !sessionToken) {
    const backendErrorCode = backendBody.error?.code ?? "AUTH_FAILED";
    const backendMessage = backendBody.error?.message ?? "Invalid phone or OTP";
    const backendRequestId = backendRes.headers.get("x-request-id") ?? requestId;
    const status = backendRes.status >= 400 ? backendRes.status : 401;
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: backendErrorCode,
          message: backendMessage,
          requestId: backendRequestId,
          ...(backendBody.error?.details ?? {}),
        },
      },
      { status }
    );
  }

  const userId =
    typeof backendBody.user_id === "string" ? backendBody.user_id.trim() : "";
  const tenantId =
    typeof backendBody.tenant_id === "string" ? backendBody.tenant_id.trim() : "";

  const response = NextResponse.json(
    {
      ok: true,
      session_token: sessionToken,
      ...(userId ? { user_id: userId } : {}),
      ...(tenantId ? { tenant_id: tenantId } : {}),
    },
    { status: 200 },
  );
  /** 7-day persistent cookie — must align with JWT TTL issued by the backend. */
  response.cookies.set(
    buildSessionCookieOptions({
      token: sessionToken,
      maxAgeSeconds: SESSION_COOKIE_MAX_AGE_SECONDS,
    }),
  );
  return response;
}
