import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";
import { NextResponse } from "next/server";

export async function proxyFinanceReceiptUpload(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const incoming = new URL(req.url);
  const registrationId = incoming.searchParams.get("registrationId")?.trim() ?? "";
  if (registrationId.length === 0) {
    return NextResponse.json(
      { error: { code: "REGISTRATION_ID_REQUIRED", message: "registrationId is required" } },
      { status: 400 }
    );
  }

  const contentType = req.headers.get("content-type")?.trim() ?? "";
  if (contentType.length === 0) {
    return NextResponse.json(
      { error: { code: "CONTENT_TYPE_REQUIRED", message: "Content-Type is required" } },
      { status: 400 }
    );
  }

  const fileName = req.headers.get("x-receipt-file-name")?.trim();
  const body = new Uint8Array(await req.arrayBuffer());
  const params = new URLSearchParams({ registrationId });

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const backendRes = await operatorApiFetch(`${apiBase}/finance/receipts/upload?${params.toString()}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Type": contentType,
        "Content-Length": String(body.byteLength),
        ...(fileName !== undefined && fileName.length > 0
          ? { "X-Receipt-File-Name": fileName }
          : {}),
      },
      body,
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
