import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export async function GET(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }
  const incoming = new URL(req.url);
  try {
    const backendRes = await operatorApiFetch(
      `${resolveTourOpsApiBaseUrl()}/bookings/member-cancellation-requests${incoming.search}`,
      {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          host: incoming.host.split(":")[0] ?? "localhost",
        },
        cache: "no-store",
      }
    );
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, {
      status: backendRes.status,
      headers: { "Cache-Control": "private, no-store, max-age=0, must-revalidate" },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
}
