import { NextResponse } from "next/server";

import { bffCodedError } from "@/auth/bff-coded-error";
import { mapPublicAuthBffCatchError } from "@/auth/public-auth-bff-error";
import { buildIdentityBffHeadersAsync } from "@/auth/resolve-identity-bff-tenant";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type VerifyOtpBody = {
  phone?: unknown;
  otp?: unknown;
  challenge_id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as VerifyOtpBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const challengeId =
    typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";

  if (phone.length === 0) {
    return bffCodedError("MOBILE_REQUIRED", 400);
  }
  if (otp.length === 0 || challengeId.length === 0) {
    return bffCodedError("OTP_PAYLOAD_INVALID", 400);
  }

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/public/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await buildIdentityBffHeadersAsync(req)),
      },
      body: JSON.stringify({
        mobile: phone,
        code: otp,
        challengeId,
      }),
    });
  } catch (error) {
    return mapPublicAuthBffCatchError(error);
  }

  const backendBody = (await backendRes.json().catch(() => ({}))) as {
    sessionToken?: unknown;
    requiresRegistration?: unknown;
    onboardingToken?: unknown;
    userId?: unknown;
    tenantId?: unknown;
    code?: unknown;
  };

  if (!backendRes.ok) {
    return bffCodedError(
      typeof backendBody.code === "string" ? backendBody.code : "LOGIN_FAILED",
      backendRes.status
    );
  }

  if (backendBody.requiresRegistration === true) {
    const onboardingToken =
      typeof backendBody.onboardingToken === "string" ? backendBody.onboardingToken : "";
    if (onboardingToken.length === 0) {
      return bffCodedError("ONBOARDING_TOKEN_MISSING", 502);
    }
    return NextResponse.json(
      {
        ok: true,
        requires_registration: true,
        onboarding_token: onboardingToken,
      },
      { status: 200 }
    );
  }

  const sessionToken =
    typeof backendBody.sessionToken === "string" ? backendBody.sessionToken : "";
  if (sessionToken.length === 0) {
    return bffCodedError("SESSION_TOKEN_MISSING", 502);
  }

  const res = NextResponse.json(
    {
      ok: true,
      session_token: sessionToken,
      user_id: backendBody.userId,
      tenant_id: backendBody.tenantId,
    },
    { status: 200 }
  );
  setSessionCookieOnResponse(res.headers, sessionToken);
  return res;
}
