import { NextResponse } from "next/server";

import { bffCodedError } from "@/auth/bff-coded-error";
import { buildIdentityBffHeadersAsync } from "@/auth/identity-bff-headers";
import { mapOperatorAuthBffCatchError } from "@/auth/operator-auth-bff-error";
import { decodeJwtPayload } from "@/auth/decode-jwt-payload";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { setOperatorWelcomeArmedCookieOnResponse } from "@/auth/operator-welcome-cookie";
import { normalizeOtpDigits } from "@/features/auth/otp-segment-input.logic";
import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type LoginPayload = {
  phone?: unknown;
  otp?: unknown;
  challenge_id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as LoginPayload;
  const phone = normalizeNumericInputValue(
    typeof body.phone === "string" ? body.phone.trim() : "",
    "phone"
  );
  const otp = normalizeOtpDigits(typeof body.otp === "string" ? body.otp.trim() : "");
  const challengeId =
    typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";

  if (phone.length === 0) {
    return bffCodedError("MOBILE_REQUIRED", 400);
  }
  if (otp.length === 0) {
    return bffCodedError("OTP_PAYLOAD_INVALID", 400);
  }

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await buildIdentityBffHeadersAsync(req)),
      },
      body: JSON.stringify({
        mobile: phone,
        code: otp,
        challengeId: challengeId.length > 0 ? challengeId : undefined,
      }),
    });
  } catch (error) {
    return mapOperatorAuthBffCatchError(error);
  }

  const backendBody = (await backendRes.json().catch(() => ({}))) as {
    sessionToken?: unknown;
    requiresRegistration?: unknown;
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
    return bffCodedError("AUTH_PHONE_NOT_AUTHORIZED", 403);
  }

  const sessionToken =
    typeof backendBody.sessionToken === "string" ? backendBody.sessionToken : "";
  if (sessionToken.length === 0) {
    return bffCodedError("SESSION_TOKEN_MISSING", 502);
  }

  const claims = decodeJwtPayload(sessionToken);
  const sessionRole = typeof claims?.role === "string" ? claims.role.trim() : "";
  if (sessionRole !== "owner") {
    return bffCodedError("AUTH_OWNER_PANEL_ONLY", 403);
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
  setOperatorWelcomeArmedCookieOnResponse(res.headers);
  return res;
}
