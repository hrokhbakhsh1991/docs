import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { params: Promise<{ pageKey: string }> };

async function proxyMarketingPages(
  req: Request,
  pageKey: string,
  method: "GET" | "PATCH",
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path = `/settings/marketing-pages/${encodeURIComponent(pageKey)}${query.length > 0 ? `?${query}` : ""}`;
  const body = method === "PATCH" ? await req.text() : undefined;
  try {
    const backendRes = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "BACKEND_UNREACHABLE" } }, { status: 502 });
  }
}

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { pageKey } = await context.params;
  return proxyMarketingPages(req, pageKey, "GET");
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const { pageKey } = await context.params;
  return proxyMarketingPages(req, pageKey, "PATCH");
}
