import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type ProxyWorkspaceDraftOptions = {
  readonly workspaceId: string;
  readonly namespace: string;
  readonly key: string;
  readonly method: "GET" | "PATCH" | "DELETE";
  readonly body?: string;
};

function backendDraftPath(workspaceId: string, namespace: string, key: string): string {
  return `/workspaces/${encodeURIComponent(workspaceId)}/drafts/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`;
}

function backendDraftEventsPath(
  workspaceId: string,
  namespace: string,
  key: string,
  incoming: URL
): string {
  const base = `${backendDraftPath(workspaceId, namespace, key)}/events`;
  const limit = incoming.searchParams.get("limit")?.trim() ?? "";
  return limit.length > 0 ? `${base}?limit=${encodeURIComponent(limit)}` : base;
}

function backendDraftListPath(workspaceId: string, incoming: URL): string {
  const base = `/workspaces/${encodeURIComponent(workspaceId)}/drafts`;
  const namespace = incoming.searchParams.get("namespace")?.trim() ?? "";
  return namespace.length > 0
    ? `${base}?namespace=${encodeURIComponent(namespace)}`
    : base;
}

type ProxyWorkspaceDraftListOptions = {
  readonly workspaceId: string;
};

type ProxyWorkspaceDraftEventsOptions = {
  readonly workspaceId: string;
  readonly namespace: string;
  readonly key: string;
};

export async function proxyWorkspaceDraftEventsApiRequest(
  req: Request,
  options: ProxyWorkspaceDraftEventsOptions
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const incoming = new URL(req.url);

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await fetch(
      `${apiBase}${backendDraftEventsPath(options.workspaceId, options.namespace, options.key, incoming)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          host: incoming.host.split(":")[0] ?? "localhost",
        },
        cache: "no-store",
      }
    );
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
}

export async function proxyWorkspaceDraftListApiRequest(
  req: Request,
  options: ProxyWorkspaceDraftListOptions
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const incoming = new URL(req.url);

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await fetch(`${apiBase}${backendDraftListPath(options.workspaceId, incoming)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
}

export async function proxyWorkspaceDraftApiRequest(
  req: Request,
  options: ProxyWorkspaceDraftOptions
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const incoming = new URL(req.url);
  const idempotencyKey = req.headers.get("idempotency-key")?.trim();

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await fetch(
      `${apiBase}${backendDraftPath(options.workspaceId, options.namespace, options.key)}`,
      {
        method: options.method,
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          host: incoming.host.split(":")[0] ?? "localhost",
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(idempotencyKey != null && idempotencyKey.length > 0
            ? { "Idempotency-Key": idempotencyKey }
            : {}),
        },
        ...(options.body !== undefined ? { body: options.body } : {}),
        cache: "no-store",
      }
    );
    const payload =
      backendRes.status === 204
        ? null
        : ((await backendRes.json().catch(() => ({}))) as Record<string, unknown>);
    if (backendRes.status === 204) {
      return new NextResponse(null, { status: 204 });
    }
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
}
