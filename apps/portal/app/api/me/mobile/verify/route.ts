import { NextResponse } from "next/server";

import { setSessionCookieOnResponse } from "@/auth/build-session-cookie";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

function resolveIngressHost(req: Request): string {
  return req.headers.get("host") ?? "localhost:3003";
}

type VerifyBody = {
  phone?: unknown;
  otp?: unknown;
  challenge_id?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as VerifyBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const otp = typeof body.otp === "string" ? body.otp.trim() : "";
  const challengeId =
    typeof body.challenge_id === "string" ? body.challenge_id.trim() : "";

  if (phone.length === 0) {
    return NextResponse.json({ ok: false, code: "MOBILE_REQUIRED" }, { status: 400 });
  }
  if (otp.length === 0 || challengeId.length === 0) {
    return NextResponse.json({ ok: false, code: "OTP_PAYLOAD_INVALID" }, { status: 400 });
  }

  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/mobile/verify`, {
      method: "POST",
      headers: {
        ...headers,
        host: ingressHost,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        mobile: phone,
        code: otp,
        challengeId,
      }),
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as {
      code?: unknown;
      sessionToken?: unknown;
      profile?: { mobile?: unknown };
    };
    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, code: typeof payload.code === "string" ? payload.code : "MOBILE_CHANGE_FAILED" },
        { status: backendRes.status }
      );
    }

    const sessionToken =
      typeof payload.sessionToken === "string" ? payload.sessionToken.trim() : "";
    if (sessionToken.length === 0) {
      return NextResponse.json({ ok: false, code: "SESSION_TOKEN_MISSING" }, { status: 502 });
    }

    const res = NextResponse.json(
      {
        ok: true,
        mobile:
          typeof payload.profile?.mobile === "string" ? payload.profile.mobile : phone,
      },
      { status: 200 }
    );
    setSessionCookieOnResponse(res.headers, sessionToken);
    return res;
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}
