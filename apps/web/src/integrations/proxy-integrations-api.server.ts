import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type ProxyIntegrationsOptions = {
  readonly path: string;
  readonly method: string;
  readonly body?: string;
};

export async function proxyIntegrationsApiRequest(
  req: Request,
  options: ProxyIntegrationsOptions
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
    const backendRes = await operatorApiFetch(`${apiBase}${options.path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body !== undefined ? { body: options.body } : {}),
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

export async function proxyIntegrationsApiGet(
  req: Request,
  backendPath: string
): Promise<NextResponse> {
  return proxyIntegrationsApiRequest(req, { path: backendPath, method: "GET" });
}

export async function proxyIntegrationsApiPost(
  req: Request,
  backendPath: string,
  body?: string
): Promise<NextResponse> {
  return proxyIntegrationsApiRequest(req, {
    path: backendPath,
    method: "POST",
    body,
  });
}

export async function proxyIntegrationsApiPatch(
  req: Request,
  backendPath: string,
  body: string
): Promise<NextResponse> {
  return proxyIntegrationsApiRequest(req, { path: backendPath, method: "PATCH", body });
}

export async function proxyIntegrationsApiDelete(
  req: Request,
  backendPath: string
): Promise<NextResponse> {
  return proxyIntegrationsApiRequest(req, { path: backendPath, method: "DELETE" });
}
