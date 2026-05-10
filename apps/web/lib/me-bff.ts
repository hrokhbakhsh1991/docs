import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { normalizeTourOpsApiOrigin } from "@/lib/tour-ops-api-origin";

/**
 * Origin for server-side BFF proxies to Nest (`/api/v2/...`).
 * Strips a trailing `/api/v2` so callers never double-prefix paths.
 * Prefer `TOUR_OPS_API_URL`; falls back to `NEXT_PUBLIC_API_URL` then local default.
 */
export function resolveMeBackendUrl(): string {
  const fromTourOps = process.env.TOUR_OPS_API_URL?.trim();
  const fromPublic = process.env.NEXT_PUBLIC_API_URL?.trim();
  const raw = fromTourOps || fromPublic || "http://denali.localhost:3001";
  return normalizeTourOpsApiOrigin(raw);
}

export function meAuthHeaders(req: Request): HeadersInit | null {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (!token) {
    return null;
  }
  return {
    Authorization: `Bearer ${token}`,
    host: req.headers.get("host") ?? ""
  };
}

/**
 * Proxies a JSON POST to Nest `POST /api/v2/me${relativePath}` (e.g. `/verify-email`).
 */
export async function proxyMePost(req: Request, relativePath: string): Promise<NextResponse> {
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

  const backendRes = await fetch(`${resolveMeBackendUrl()}/api/v2/me${relativePath}`, {
    method: "POST",
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
