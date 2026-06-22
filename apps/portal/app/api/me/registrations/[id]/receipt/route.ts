import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

type RouteContext = { params: Promise<{ id: string }> };

function sanitizeReceiptFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "receipt";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "receipt";
}

function buildMemberReceiptFileKey(registrationId: string, fileName: string): string {
  return `receipts/${registrationId}/${sanitizeReceiptFileName(fileName)}`;
}

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

  const fileKey = buildMemberReceiptFileKey(registrationId, file.name);
  const noteRaw = form.get("note");
  const note = typeof noteRaw === "string" && noteRaw.trim().length > 0 ? noteRaw.trim() : undefined;

  const apiBase = resolveTourOpsApiBaseUrl();
  const res = await fetch(`${apiBase}/bookings/${encodeURIComponent(registrationId)}/receipts`, {
    method: "POST",
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      fileKey,
      ...(note !== undefined ? { note } : {}),
    }),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: typeof payload.code === "string" ? payload.code : "RECEIPT_UPLOAD_FAILED" },
      { status: res.status }
    );
  }
  return NextResponse.json({ ok: true, data: payload }, { status: 201 });
}
