import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";

import { bffCodedError } from "@/auth/bff-coded-error";
import { buildIdentityBffHeadersAsync } from "@/auth/identity-bff-headers";
import { mapOperatorAuthBffCatchError } from "@/auth/operator-auth-bff-error";
import { decodeJwtPayload } from "@app-tour/session-client";
import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { canonicalizeOperatorLoginPhone } from "@/features/auth/canonicalize-operator-login-phone";
import { normalizeOtpDigits } from "@/features/auth/otp-segment-input.logic";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";
import { isDevWebSessionAllowed } from "@/tenant/auth-env";

type LoginPayload = {
  phone?: unknown;
  otp?: unknown;
  challenge_id?: unknown;
};

const ALLOWED_TEAM_PANEL_ROLES = new Set(["admin", "viewer"]);

export async function POST(req: Request): Promise<NextResponse> {
  if (!isDevWebSessionAllowed()) {
    return bffCodedError("AUTH_OWNER_PANEL_ONLY", 403);
  }

  const body = (await req.json().catch(() => ({}))) as LoginPayload;
  const phone = canonicalizeOperatorLoginPhone(
    typeof body.phone === "string" ? body.phone : "",
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
    backendRes = await operatorApiFetch(`${apiBase}/auth/verify-otp`, {
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
      backendRes.status,
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
  if (!ALLOWED_TEAM_PANEL_ROLES.has(sessionRole)) {
    return bffCodedError("AUTH_OWNER_PANEL_ONLY", 403);
  }

  const res = NextResponse.json(
    {
      ok: true,
      session_token: sessionToken,
      user_id: backendBody.userId,
      tenant_id: backendBody.tenantId,
    },
    { status: 200 },
  );
  setSessionCookieOnResponse(res.headers, sessionToken);
  return res;
}
