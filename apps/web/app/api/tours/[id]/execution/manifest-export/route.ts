import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }

  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const suffix = query.length > 0 ? `?${query}` : "";

  const backendRes = await operatorApiFetch(
    `${resolveTourOpsApiBaseUrl()}/tours/${encodeURIComponent(id)}/execution/manifest/export${suffix}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    },
  );

  if (!backendRes.ok) {
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  }

  const buffer = await backendRes.arrayBuffer();
  const headers = new Headers();
  const cd = backendRes.headers.get("content-disposition");
  const ct = backendRes.headers.get("content-type");
  if (cd) {
    headers.set("Content-Disposition", cd);
  }
  headers.set(
    "Content-Type",
    ct ?? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  return new NextResponse(buffer, { status: 200, headers });
}
