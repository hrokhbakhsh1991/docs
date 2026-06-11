import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type RouteContext = {
  readonly params: Promise<{ id: string }>;
};

async function proxyTourRequest(
  req: Request,
  tourId: string,
  method: "GET" | "PATCH"
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const incoming = new URL(req.url);
  let body: string | undefined;
  if (method === "PATCH") {
    body = await req.text();
  }

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/tours/${encodeURIComponent(tourId)}`, {
      method,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        ...(body !== undefined
          ? {
              "Content-Type": "application/json",
              "Content-Length": String(Buffer.byteLength(body)),
            }
          : {}),
      },
      body,
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

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return proxyTourRequest(req, id, "GET");
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  return proxyTourRequest(req, id, "PATCH");
}
