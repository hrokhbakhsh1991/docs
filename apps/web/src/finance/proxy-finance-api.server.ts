import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type ProxyFinanceOptions = {
  readonly path: string;
  readonly method: string;
  readonly body?: string;
};

export async function proxyFinanceApiRequest(
  req: Request,
  options: ProxyFinanceOptions
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
    const backendRes = await fetch(`${apiBase}${options.path}`, {
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

export async function proxyFinanceApiGet(req: Request, backendPath: string): Promise<NextResponse> {
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path = query.length > 0 ? `${backendPath}?${query}` : backendPath;
  return proxyFinanceApiRequest(req, { path, method: "GET" });
}

export async function proxyFinanceApiPost(
  req: Request,
  backendPath: string,
  body: string
): Promise<NextResponse> {
  return proxyFinanceApiRequest(req, { path: backendPath, method: "POST", body });
}

export async function proxyFinanceApiPatch(
  req: Request,
  backendPath: string,
  body: string
): Promise<NextResponse> {
  return proxyFinanceApiRequest(req, { path: backendPath, method: "PATCH", body });
}
