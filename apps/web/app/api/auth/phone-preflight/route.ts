import { NextResponse } from "next/server";

import { bffCodedError } from "@/auth/bff-coded-error";
import {
  checkBffLoginRateLimit,
  readBffLoginRateLimitKey,
} from "@/auth/bff-login-rate-limit";
import { buildIdentityBffHeadersAsync } from "@/auth/identity-bff-headers";
import { fetchOperatorAuthBff } from "@/auth/operator-auth-bff-fetch";
import { mapOperatorAuthBffCatchError } from "@/auth/operator-auth-bff-error";

type PhonePreflightBody = {
  phone?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as PhonePreflightBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (phone.length === 0) {
    return bffCodedError("MOBILE_REQUIRED", 400);
  }

  const rateKey = readBffLoginRateLimitKey(req, phone);
  if (!checkBffLoginRateLimit(rateKey)) {
    return bffCodedError("OTP_RATE_LIMITED", 429);
  }

  let backendRes: Response;
  try {
    backendRes = await fetchOperatorAuthBff("/auth/phone-preflight", {
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
      typeof payload.code === "string" ? payload.code : "AUTH_PREFLIGHT_FAILED",
      backendRes.status
    );
  }

  return NextResponse.json(
    { ok: true, authorized: payload.authorized === true },
    { status: 200 }
  );
}
