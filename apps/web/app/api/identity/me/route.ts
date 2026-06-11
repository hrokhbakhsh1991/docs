import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

async function forwardIdentityMe(
  req: Request,
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
  const body = method === "PATCH" ? await req.text() : undefined;

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/identity/me`, {
      method,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
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

export async function GET(req: Request): Promise<NextResponse> {
  return forwardIdentityMe(req, "GET");
}

export async function PATCH(req: Request): Promise<NextResponse> {
  return forwardIdentityMe(req, "PATCH");
}
