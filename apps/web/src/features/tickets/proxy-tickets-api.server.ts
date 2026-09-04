import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type ProxyTicketsOptions = {
  readonly path: string;
  readonly method: string;
  readonly body?: string;
};

export async function proxyTicketsApiRequest(
  req: Request,
  options: ProxyTicketsOptions,
): Promise<Response> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { ok: false, code: "AUTH_UNAUTHENTICATED", message: "Authentication required" },
      { status: 401 },
    );
  }

  const incoming = new URL(req.url);
  const apiBase = resolveTourOpsApiBaseUrl();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${sessionToken}`,
    host: incoming.host.split(":")[0] ?? "localhost",
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const idempotencyKey = req.headers.get("idempotency-key") ?? req.headers.get("Idempotency-Key");
  if (idempotencyKey !== null && idempotencyKey.trim().length > 0) {
    headers["Idempotency-Key"] = idempotencyKey.trim();
  }

  return operatorApiFetch(`${apiBase}${options.path}`, {
    method: options.method,
    headers,
    ...(options.body !== undefined ? { body: options.body } : {}),
    cache: "no-store",
  });
}

export async function proxyTicketsApiGet(req: Request, backendPath: string): Promise<Response> {
  const incoming = new URL(req.url);
  const incomingQuery = incoming.searchParams.toString();
  const path =
    incomingQuery.length > 0 && !backendPath.includes("?")
      ? `${backendPath}?${incomingQuery}`
      : backendPath;
  return proxyTicketsApiRequest(req, { path, method: "GET" });
}

export function readTicketsIdempotencyKey(req: Request): string | undefined {
  const key =
    req.headers.get("idempotency-key")?.trim() ?? req.headers.get("Idempotency-Key")?.trim();
  return key !== undefined && key.length > 0 ? key : undefined;
}

export function jsonTicketsBffError(
  code: string,
  status: number,
  message?: string,
): NextResponse {
  return NextResponse.json(
    { ok: false, code, ...(message !== undefined ? { message } : {}) },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}
