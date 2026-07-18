import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

/**
 * Same-origin proof stream for admin <img> (avoids MinIO CORS on *.admin.localhost).
 * Resolves a presigned URL via API, then proxies bytes.
 */
export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json(
      { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
      { status: 401 }
    );
  }

  const { id } = await context.params;
  const incoming = new URL(req.url);
  const host = incoming.host.split(":")[0] ?? "localhost";

  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    const metaRes = await fetch(`${apiBase}/finance/receipts/${encodeURIComponent(id)}/url`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host,
      },
      cache: "no-store",
    });
    const meta = (await metaRes.json().catch(() => ({}))) as { url?: unknown; code?: unknown };
    if (!metaRes.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: typeof meta.code === "string" ? meta.code : "RECEIPT_URL_FAILED",
          },
        },
        { status: metaRes.status }
      );
    }

    const sourceUrl = typeof meta.url === "string" ? meta.url.trim() : "";
    if (!/^https?:\/\//i.test(sourceUrl)) {
      return NextResponse.json(
        { ok: false, error: { code: "RECEIPT_PROOF_UNAVAILABLE" } },
        { status: 404 }
      );
    }

    const fileRes = await fetch(sourceUrl, { cache: "no-store" });
    if (!fileRes.ok) {
      return NextResponse.json(
        { ok: false, error: { code: "RECEIPT_PROOF_FETCH_FAILED" } },
        { status: 502 }
      );
    }

    const contentType = fileRes.headers.get("content-type") ?? "application/octet-stream";
    const bytes = await fileRes.arrayBuffer();
    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
      { status: 502 }
    );
  }
}
