import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";

function resolveIngressHost(req: Request): string {
  return req.headers.get("host") ?? "localhost:3003";
}

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const contentType = req.headers.get("content-type")?.trim() ?? "";
  if (contentType.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_UPLOAD_HEADERS" }, { status: 400 });
  }

  const body = new Uint8Array(await req.arrayBuffer());
  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/avatar`, {
      method: "POST",
      headers: {
        ...headers,
        host: ingressHost,
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
      },
      body,
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const host = resolveIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const ingressHost = host.split(":")[0] ?? host;

  try {
    const backendRes = await fetch(`${resolveTourOpsApiBaseUrl()}/identity/me/avatar`, {
      method: "DELETE",
      headers: { ...headers, host: ingressHost },
      cache: "no-store",
    });
    const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}
