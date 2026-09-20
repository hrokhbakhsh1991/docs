import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { params: Promise<{ pageKey: string }> };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const { pageKey } = await context.params;
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path = `/settings/marketing-pages/${encodeURIComponent(pageKey)}/publish${query.length > 0 ? `?${query}` : ""}`;
  try {
    const backendRes = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "BACKEND_UNREACHABLE" } }, { status: 502 });
  }
}
