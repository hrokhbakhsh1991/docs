import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { parseMemberReceiptPanel } from "@/me/member-receipt-status";
import { resolveTourOpsApiBaseUrl } from "@/env";

type RouteContext = { params: Promise<{ id: string }> };

function sanitizeReceiptFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "receipt";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "receipt";
}

function resolveReceiptContentType(file: File): string {
  const typed = file.type.trim().toLowerCase();
  if (typed.length > 0) {
    return typed;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  return "image/jpeg";
}

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id: registrationId } = await context.params;
  const host = req.headers.get("host") ?? "localhost:3003";
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const apiBase = resolveTourOpsApiBaseUrl();
  const res = await fetch(`${apiBase}/bookings/${encodeURIComponent(registrationId)}/receipts`, {
    method: "GET",
    headers,
    cache: "no-store",
  });
  const payload = (await res.json().catch(() => ({}))) as { status?: unknown; code?: unknown };
  if (!res.ok) {
    return NextResponse.json(
      {
        ok: false,
        code: typeof payload.code === "string" ? payload.code : "RECEIPT_STATUS_FAILED",
      },
      { status: res.status }
    );
  }
  const panel = parseMemberReceiptPanel(payload);
  return NextResponse.json({ ok: true, ...panel }, { status: 200 });
}

/**
 * Forwards member receipt proof bytes to API (MinIO put + pending receipt).
 * JSON fileKey-only path is API-only (memory smoke); portal always sends the file body.
 */
export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const { id: registrationId } = await context.params;
  const host = req.headers.get("host") ?? "localhost:3003";
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, code: "FILE_REQUIRED" }, { status: 400 });
  }

  const contentType = resolveReceiptContentType(file);
  const fileName = sanitizeReceiptFileName(file.name);
  const body = Buffer.from(await file.arrayBuffer());
  const ingressHost = host.split(":")[0] ?? host;

  const apiBase = resolveTourOpsApiBaseUrl();
  try {
    const res = await fetch(`${apiBase}/bookings/${encodeURIComponent(registrationId)}/receipts`, {
      method: "POST",
      headers: {
        ...headers,
        host: ingressHost,
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "x-receipt-file-name": fileName,
      },
      body,
      cache: "no-store",
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          code: typeof payload.code === "string" ? payload.code : "RECEIPT_UPLOAD_FAILED",
        },
        { status: res.status }
      );
    }
    return NextResponse.json({ ok: true, data: payload, status: "pending" as const }, { status: 201 });
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}
