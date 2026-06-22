import { NextResponse } from "next/server";

import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolveTourOpsApiBaseUrl } from "@/env";

type RouteContext = { params: Promise<{ id: string }> };

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

  const body = new FormData();
  body.append("registrationId", registrationId);
  body.append("file", file, file.name);

  const apiBase = resolveTourOpsApiBaseUrl();
  const res = await fetch(`${apiBase}/finance/receipts`, {
    method: "POST",
    headers: {
      ...headers,
    },
    body,
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
