import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id: tourId } = await context.params;
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const path =
      query.length > 0
        ? `/tours/${encodeURIComponent(tourId)}/operational-roster?${query}`
        : `/tours/${encodeURIComponent(tourId)}/operational-roster`;
    backendRes = await operatorApiFetch(`${apiBase}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
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
