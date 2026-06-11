import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export async function POST(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const body = await req.text();
  const incoming = new URL(req.url);

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/tours/clone-photo-remint`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
      },
      body,
    });
  } catch {
    return NextResponse.json(
      { error: { code: "UPSTREAM_UNAVAILABLE", message: "Tour API unavailable" } },
      { status: 503 }
    );
  }

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
