import { NextResponse } from "next/server";

import { setImpersonationSessionCookieOnResponse } from "@/auth/build-impersonation-session-cookie";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type Payload = {
  sessionToken?: unknown;
};

export async function POST(req: Request): Promise<NextResponse> {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const sessionToken = typeof body.sessionToken === "string" ? body.sessionToken.trim() : "";
  if (sessionToken.length === 0) {
    return NextResponse.json({ error: "sessionToken required" }, { status: 400 });
  }

  const apiBase = resolveTourOpsApiBaseUrl();
  const upstream = await fetch(`${apiBase}/auth/accept-platform-impersonation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken }),
    cache: "no-store",
  });

  if (!upstream.ok) {
    const errorBody = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(errorBody, { status: upstream.status });
  }

  const accepted = (await upstream.json()) as { sessionToken?: string };
  const token = accepted.sessionToken ?? sessionToken;
  const res = NextResponse.json({ ok: true });
  setImpersonationSessionCookieOnResponse(res.headers, token);
  return res;
}
