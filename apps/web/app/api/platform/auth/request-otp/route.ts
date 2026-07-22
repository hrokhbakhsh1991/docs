import { NextResponse } from "next/server";

import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

function readPlatformOpsPhones(): string[] {
  const raw = process.env.PLATFORM_OPS_PHONES?.trim();
  if (!raw) return [];
  return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
}

type RequestOtpBody = {
  phone?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as RequestOtpBody;
  const phone = normalizeNumericInputValue(
    typeof body.phone === "string" ? body.phone.trim() : "",
    "phone"
  );
  if (phone.length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: "MOBILE_REQUIRED", message: "Phone required" } },
      { status: 400 }
    );
  }

  const allowedPhones = readPlatformOpsPhones();
  if (allowedPhones.length > 0 && !allowedPhones.includes(phone)) {
    return NextResponse.json(
      { ok: false, error: { code: "PLATFORM_FORBIDDEN", message: "Phone not authorized" } },
      { status: 403 }
    );
  }

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const upstream = await fetch(`${apiBase}/platform/v1/auth/request-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const payload = (await upstream.json().catch(() => ({}))) as {
      challengeId?: string;
      code?: string;
    };
    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: typeof payload.code === "string" ? payload.code : "OTP_REQUEST_FAILED",
          },
        },
        { status: upstream.status }
      );
    }
    return NextResponse.json(
      { ok: true, challenge_id: payload.challengeId },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
}
