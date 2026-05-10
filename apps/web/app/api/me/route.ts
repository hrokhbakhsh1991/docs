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
  const out = NextResponse.json(payload, { status: backendRes.status });
  const etag = backendRes.headers.get("etag");
  if (etag && etag.trim() !== "") {
    out.headers.set("ETag", etag.trim());
    out.headers.set("Cache-Control", backendRes.headers.get("cache-control") ?? "private, no-store");
  }
  return out;
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

  const ifMatch = typeof req.headers.get === "function" ? req.headers.get("if-match") : null;
  const idempotencyKey = typeof req.headers.get === "function" ? req.headers.get("idempotency-key") : null;

  const forward = new Headers(headers);
  forward.set("Content-Type", "application/json");
  if (ifMatch !== null && ifMatch.trim() !== "") {
    forward.set("If-Match", ifMatch.trim());
  }
  if (idempotencyKey !== null && idempotencyKey.trim() !== "") {
    forward.set("Idempotency-Key", idempotencyKey.trim());
  }

  const backendRes = await fetch(`${resolveMeBackendUrl()}/api/v2/me`, {
    method: "PATCH",
    headers: forward,
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
