import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

export async function proxyEngagementApiGet(req: Request, backendPath: string): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path = query.length > 0 ? `${backendPath}?${query}` : backendPath;
  try {
    const backendRes = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}${path}`, {
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
    return NextResponse.json({ ok: false, error: { code: "BACKEND_UNREACHABLE" } }, { status: 502 });
  }
}

export async function proxyEngagementApiPost(
  req: Request,
  backendPath: string,
  body: string,
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const incoming = new URL(req.url);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
      host: incoming.host.split(":")[0] ?? "localhost",
      "Content-Type": "application/json",
    };
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey !== null && idempotencyKey.trim().length > 0) {
      headers["Idempotency-Key"] = idempotencyKey.trim();
    }
    const backendRes = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}${backendPath}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "BACKEND_UNREACHABLE" } }, { status: 502 });
  }
}

export async function proxyEngagementApiPatch(
  req: Request,
  backendPath: string,
  body: string,
): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const incoming = new URL(req.url);
  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${sessionToken}`,
      host: incoming.host.split(":")[0] ?? "localhost",
      "Content-Type": "application/json",
    };
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey !== null && idempotencyKey.trim().length > 0) {
      headers["Idempotency-Key"] = idempotencyKey.trim();
    }
    const backendRes = await operatorApiFetch(`${resolveTourOpsApiBaseUrl()}${backendPath}`, {
      method: "PATCH",
      headers,
      body,
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, error: { code: "BACKEND_UNREACHABLE" } }, { status: 502 });
  }
}
