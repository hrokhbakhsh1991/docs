import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { SESSION_TOKEN_COOKIE } from "@/lib/auth/session-cookie";
import { resolveMeBackendUrl } from "@/lib/me-bff";

function authHeaders(req: Request): HeadersInit | null {
  const token = cookies().get(SESSION_TOKEN_COOKIE)?.value?.trim();
  if (!token) {
    return null;
  }
  return {
    Authorization: `Bearer ${token}`,
    host: req.headers.get("host") ?? ""
  };
}

type RouteContext = { params: { destinationId: string } };

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const headers = authHeaders(req);
  if (!headers) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { destinationId } = ctx.params;
  if (!destinationId?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "destinationId is required" } },
      { status: 400 }
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

  const backendRes = await fetch(
    `${resolveMeBackendUrl()}/api/v2/settings/destinations/${encodeURIComponent(destinationId)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store"
    }
  ).catch(() => null);

  if (!backendRes) {
    return NextResponse.json(
      { error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = await backendRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendRes.status });
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const headers = authHeaders(req);
  if (!headers) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { destinationId } = ctx.params;
  if (!destinationId?.trim()) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "destinationId is required" } },
      { status: 400 }
    );
  }

  const backendRes = await fetch(
    `${resolveMeBackendUrl()}/api/v2/settings/destinations/${encodeURIComponent(destinationId)}`,
    {
      method: "DELETE",
      headers,
      cache: "no-store"
    }
  ).catch(() => null);

  if (!backendRes) {
    return NextResponse.json(
      { error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  if (backendRes.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const payload = await backendRes.json().catch(() => ({}));
  return NextResponse.json(payload, { status: backendRes.status });
}
