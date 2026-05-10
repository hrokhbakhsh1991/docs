import { NextResponse } from "next/server";

import { meAuthHeaders, resolveMeBackendUrl } from "@/lib/me-bff";

export async function GET(req: Request): Promise<NextResponse> {
  const headers = meAuthHeaders(req);
  if (!headers) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const backendRes = await fetch(`${resolveMeBackendUrl()}/api/v2/me`, {
    method: "GET",
    headers,
    cache: "no-store"
  }).catch(() => null);

  if (!backendRes) {
    return NextResponse.json(
      { error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = await backendRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendRes.status });
}

export async function PATCH(req: Request): Promise<NextResponse> {
  const headers = meAuthHeaders(req);
  if (!headers) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "Request body must be JSON" } },
      { status: 400 }
    );
  }

  const backendRes = await fetch(`${resolveMeBackendUrl()}/api/v2/me`, {
    method: "PATCH",
    headers: {
      ...headers,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  }).catch(() => null);

  if (!backendRes) {
    return NextResponse.json(
      { error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = await backendRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendRes.status });
}
