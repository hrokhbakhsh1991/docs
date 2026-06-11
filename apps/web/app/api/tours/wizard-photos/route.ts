import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export async function POST(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const sessionId = req.headers.get("x-wizard-session-id")?.trim() ?? "";
  const photoId = req.headers.get("x-photo-id")?.trim() ?? "";
  const contentType = req.headers.get("content-type")?.trim() ?? "";
  if (sessionId.length === 0 || photoId.length === 0 || contentType.length === 0) {
    return NextResponse.json(
      { error: { code: "INVALID_UPLOAD_HEADERS", message: "Missing upload headers" } },
      { status: 400 }
    );
  }

  const body = new Uint8Array(await req.arrayBuffer());
  const incoming = new URL(req.url);

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/tours/wizard-photos`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        "X-Wizard-Session-Id": sessionId,
        "X-Photo-Id": photoId,
      },
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
