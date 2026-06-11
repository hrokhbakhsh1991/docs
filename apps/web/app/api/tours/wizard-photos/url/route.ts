import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

export async function GET(req: Request): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const incoming = new URL(req.url);
  const storageKey = incoming.searchParams.get("storageKey")?.trim() ?? "";
  if (storageKey.length === 0) {
    return NextResponse.json(
      { error: { code: "WIZARD_PHOTO_KEY_REQUIRED", message: "storageKey is required" } },
      { status: 400 }
    );
  }

  const params = new URLSearchParams({ storageKey });

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}/tours/wizard-photos/url?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
      },
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
