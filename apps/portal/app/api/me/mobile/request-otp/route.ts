import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

function resolveIngressHost(req: Request): string {
  return req.headers.get("host") ?? "localhost:3003";
}

type RequestOtpBody = {
  phone?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as RequestOtpBody;
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  if (phone.length === 0) {
    return NextResponse.json({ ok: false, code: "MOBILE_REQUIRED" }, { status: 400 });
  }

  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/mobile/request-otp`, {
      method: "POST",
      headers: {
        ...headers,
        host: ingressHost,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mobile: phone }),
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    if (!backendRes.ok) {
      return NextResponse.json(
        { ok: false, code: typeof payload.code === "string" ? payload.code : "OTP_REQUEST_FAILED" },
        { status: backendRes.status }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        challenge_id: payload.challengeId,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}
