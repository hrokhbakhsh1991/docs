import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/urban/urban-api-base";
import {
  isKnownWizardMediaRouteKey,
  resolveWizardMediaBackendPaths,
} from "@/wizard/resolve-wizard-media-backend-path";

function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: { code: "AUTH_UNAUTHENTICATED", message: "Authentication required" } },
    { status: 401 }
  );
}

function backendUnreachable(): NextResponse {
  return NextResponse.json(
    { ok: false, error: { code: "BACKEND_UNREACHABLE", message: "Backend unavailable" } },
    { status: 502 }
  );
}

function unknownMediaRouteKey(mediaRouteKey: string): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: "UNKNOWN_WIZARD_MEDIA_ROUTE_KEY",
        message: `Unsupported wizard media route: ${mediaRouteKey}`,
      },
    },
    { status: 404 }
  );
}

export async function proxyWizardMediaUpload(
  req: Request,
  mediaRouteKey: string
): Promise<NextResponse> {
  const normalizedKey = mediaRouteKey.trim();
  if (!isKnownWizardMediaRouteKey(normalizedKey)) {
    return unknownMediaRouteKey(normalizedKey);
  }

  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return unauthorized();
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
  const backend = resolveWizardMediaBackendPaths(normalizedKey);

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}${backend.upload}`, {
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
    return backendUnreachable();
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}

export async function proxyWizardMediaSignedUrl(
  req: Request,
  mediaRouteKey: string
): Promise<NextResponse> {
  const normalizedKey = mediaRouteKey.trim();
  if (!isKnownWizardMediaRouteKey(normalizedKey)) {
    return unknownMediaRouteKey(normalizedKey);
  }

  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return unauthorized();
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
  const backend = resolveWizardMediaBackendPaths(normalizedKey);

  let backendRes: Response;
  try {
    const apiBase = resolveTourOpsApiBaseUrl();
    backendRes = await fetch(`${apiBase}${backend.signedUrl}?${params.toString()}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
      },
      cache: "no-store",
    });
  } catch {
    return backendUnreachable();
  }

  const payload = (await backendRes.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: backendRes.status });
}
