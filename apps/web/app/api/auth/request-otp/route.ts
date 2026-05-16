import { NextResponse } from "next/server";

import { bffFetch } from "@/lib/api/bff-fetch";
import { bffGuardErrorResponse } from "@/lib/api/bff-error-response";
import { normalizeOtpPhoneInput } from "@/lib/otp-phone-normalize";

type RequestOtpBody = {
  phone?: unknown;
  invite_token?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as RequestOtpBody;
  const phone =
    typeof body.phone === "string" ? normalizeOtpPhoneInput(body.phone) : "";
  const inviteToken = typeof body.invite_token === "string" ? body.invite_token.trim() : undefined;
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "phone is required" } },
      { status: 400 }
    );
  }
  let backendRes: Response;
  try {
    backendRes = await bffFetch(req, "/api/v2/auth/web/otp/request", {
      method: "POST",
      body: JSON.stringify({
        phone,
        ...(inviteToken ? { invite_token: inviteToken } : {}),
      }),
    });
  } catch (e) {
    const guard = bffGuardErrorResponse(e);
    if (guard) {
      return guard;
    }
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 },
    );
  }
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!backendRes.ok) {
    console.error("auth_request_otp_backend_error", {
      status: backendRes.status,
      body: payload
    });
    const backendError = (payload as { error?: { code?: unknown; message?: unknown } }).error;
    return NextResponse.json(
      {
        ok: false,
        error_code:
          typeof backendError?.code === "string" ? backendError.code : "AUTH_OTP_REQUEST_FAILED",
        message:
          typeof backendError?.message === "string"
            ? backendError.message
            : "Failed to request OTP"
      },
      { status: backendRes.status }
    );
  }
  return NextResponse.json({ ok: true, ...payload }, { status: 200 });
}
