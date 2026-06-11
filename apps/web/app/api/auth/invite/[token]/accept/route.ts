import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type RouteContext = {
  readonly params: Promise<{ readonly token: string }>;
};

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { token } = await context.params;
  const incoming = new URL(req.url);

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/auth/invite/${token}/accept`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Length": "0",
      },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
