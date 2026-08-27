import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";

import {
  buildPlatformSessionCookieHeader,
  type PlatformOpsSessionPayload,
} from "@/platform/build-platform-session-cookie";
import { normalizeOtpDigits } from "@/features/auth/otp-segment-input.logic";
import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

function readPlatformOpsPhones(): string[] {
  const raw = process.env.PLATFORM_OPS_PHONES?.trim();
  if (!raw) {
    return [];
  }
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

type LoginPayload = {
  phone?: unknown;
  otp?: unknown;
  challenge_id?: unknown;
};

type VerifyOtpResponse = {
  platformSessionToken?: string;
  role?: PlatformOpsSessionPayload["role"];
  mobile?: string;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as LoginPayload;
  const phone = normalizeNumericInputValue(
    typeof body.phone === "string" ? body.phone.trim() : "",
    "phone"
  );
  const otp = normalizeOtpDigits(typeof body.otp === "string" ? body.otp.trim() : "");
  const allowedPhones = readPlatformOpsPhones();
  if (allowedPhones.length > 0 && !allowedPhones.includes(phone)) {
    return NextResponse.json(
      { ok: false, error: { code: "PLATFORM_FORBIDDEN", message: "Phone not authorized" } },
      { status: 403 }
    );
  }

  if (phone.length === 0 || otp.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "OTP_PAYLOAD_INVALID", message: "Phone and OTP required" } },
      { status: 400 }
    );
  }

  let verifyPayload: VerifyOtpResponse = {};
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const verifyRes = await operatorApiFetch(`${apiBase}/platform/v1/auth/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone,
        otp,
        challengeId:
          typeof body.challenge_id === "string" && body.challenge_id.trim().length > 0
            ? body.challenge_id.trim()
            : undefined,
      }),
    });
    verifyPayload = (await verifyRes.json().catch(() => ({}))) as VerifyOtpResponse;
    if (!verifyRes.ok || typeof verifyPayload.platformSessionToken !== "string") {
      return NextResponse.json(
        { ok: false, error: { code: "LOGIN_FAILED", message: "OTP verification failed" } },
        { status: verifyRes.status }
      );
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const role = verifyPayload.role ?? "owner";
  const res = NextResponse.json(
    {
      ok: true,
      phone,
      role,
    },
    { status: 200 }
  );
  res.headers.append(
    "Set-Cookie",
    buildPlatformSessionCookieHeader(verifyPayload.platformSessionToken!)
  );
  return res;
}
