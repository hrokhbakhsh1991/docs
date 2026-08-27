import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";

import { bffCodedError } from "@/auth/bff-coded-error";
import {
  checkBffLoginRateLimit,
  readBffLoginRateLimitKey,
} from "@/auth/bff-login-rate-limit";
import { buildIdentityBffHeadersAsync } from "@/auth/identity-bff-headers";
import { mapOperatorAuthBffCatchError } from "@/auth/operator-auth-bff-error";
import { canonicalizeOperatorLoginPhone } from "@/features/auth/canonicalize-operator-login-phone";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RequestOtpBody = {
  phone?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as RequestOtpBody;
  const phone = canonicalizeOperatorLoginPhone(
    typeof body.phone === "string" ? body.phone : ""
  );
  if (phone.length === 0) {
    return bffCodedError("MOBILE_REQUIRED", 400);
  }

  const rateKey = readBffLoginRateLimitKey(req, phone);
  if (!checkBffLoginRateLimit(rateKey)) {
    return bffCodedError("OTP_RATE_LIMITED", 429);
  }

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await operatorApiFetch(`${apiBase}/auth/request-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await buildIdentityBffHeadersAsync(req)),
      },
      body: JSON.stringify({ mobile: phone }),
    });
  } catch (error) {
    return mapOperatorAuthBffCatchError(error);
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!backendRes.ok) {
    return bffCodedError(
      typeof payload.code === "string" ? payload.code : "OTP_REQUEST_FAILED",
      backendRes.status
    );
  }

  return NextResponse.json(
    { ok: true, challenge_id: payload.challengeId },
    { status: 200 }
  );
}
