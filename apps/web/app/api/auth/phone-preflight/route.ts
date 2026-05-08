import { NextResponse } from "next/server";

function resolveBackendUrl(): string {
  return process.env.TOUR_OPS_API_URL?.trim() || "http://denali.localhost:3001";
}

type PreflightBody = {
  phone?: unknown;
  invite_token?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as PreflightBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const inviteToken = typeof body.invite_token === "string" ? body.invite_token.trim() : undefined;
  if (!phone) {
    return NextResponse.json(
      { ok: false, error: { code: "INVALID_INPUT", message: "phone is required" } },
      { status: 400 }
    );
  }
  const backendRes = await fetch(`${resolveBackendUrl()}/api/v2/auth/web/phone/preflight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      host: req.headers.get("host") ?? ""
    },
    body: JSON.stringify({
      phone,
      ...(inviteToken ? { invite_token: inviteToken } : {})
    }),
    cache: "no-store"
  }).catch(() => null);
  if (!backendRes) {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!backendRes.ok) {
    console.error("auth_phone_preflight_backend_error", {
      status: backendRes.status,
      body: payload
    });
    const backendError = (payload as { error?: { code?: unknown; message?: unknown } }).error;
    return NextResponse.json(
      {
        ok: false,
        error_code: typeof backendError?.code === "string" ? backendError.code : "AUTH_PREFLIGHT_FAILED",
        message:
          typeof backendError?.message === "string"
            ? backendError.message
            : "Could not classify phone"
      },
      { status: backendRes.status }
    );
  }
  return NextResponse.json({ ok: true, ...payload }, { status: 200 });
}
