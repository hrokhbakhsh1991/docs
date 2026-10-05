import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id: tourId } = await context.params;
  const incoming = new URL(req.url);
  let backendRes: Response;
  try {
    backendRes = await operatorApiFetch(
      `${resolveTourOpsApiBaseUrl()}/tours/${encodeURIComponent(tourId)}/operational-roster/export?${incoming.searchParams.toString()}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          host: incoming.host.split(":")[0] ?? "localhost",
        },
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  if (!backendRes.ok) {
    const payload = await backendRes.json().catch(() => ({}));
    return NextResponse.json(payload, { status: backendRes.status });
  }

  return new Response(await backendRes.arrayBuffer(), {
    status: backendRes.status,
    headers: {
      "Content-Type":
        backendRes.headers.get("Content-Type") ??
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": backendRes.headers.get("Content-Disposition") ?? "attachment",
      "Cache-Control": "no-store",
    },
  });
}
