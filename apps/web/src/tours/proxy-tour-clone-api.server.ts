import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export type ProxyTourCloneApiInput = {
  readonly tourId: string;
};

export function buildServerCloneTourApiPath(tourId: string): string {
  return `/api/tours/${encodeURIComponent(tourId)}/clone`;
}

export async function proxyTourCloneApiRequest(
  req: Request,
  input: ProxyTourCloneApiInput
): Promise<NextResponse> {
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
    backendRes = await fetch(
      `${apiBase}/tours/${encodeURIComponent(input.tourId)}/clone`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          host: incoming.host.split(":")[0] ?? "localhost",
          "Content-Type": "application/json",
          "Content-Length": String(Buffer.byteLength(body)),
        },
        body,
        cache: "no-store",
      }
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
