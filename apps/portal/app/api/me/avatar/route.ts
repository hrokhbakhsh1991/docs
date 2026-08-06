import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { invalidateMemberProfileViewForMember } from "@/me/member-profile-cache.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

function readSessionUserId(headers: Record<string, string>): string | null {
  const userId = headers["x-user-id"];
  return userId !== undefined && userId.trim().length > 0 ? userId.trim() : null;
}

/** Best-effort INV-MP-CACHE-01 — must not mask a successful upstream mutation. */
async function invalidateProfileViewAfterAvatarMutation(
  host: string,
  headers: Record<string, string>
): Promise<void> {
  try {
    const sessionUserId = readSessionUserId(headers);
    if (sessionUserId === null) {
      return;
    }
    const bootstrap = await resolvePortalBootstrapForHost(host);
    invalidateMemberProfileViewForMember({
      tenantId: bootstrap.tenantId,
      userId: sessionUserId,
      pluginId: bootstrap.pluginId,
    });
  } catch {
    // Cache may stay briefly stale; upstream avatar mutation already committed.
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
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
    if (backendRes.ok) {
      await invalidateProfileViewAfterAvatarMutation(host, headers);
    }
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
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
    if (backendRes.ok) {
      await invalidateProfileViewAfterAvatarMutation(host, headers);
    }
    return NextResponse.json(payload, { status: backendRes.status });
  } catch {
    return NextResponse.json({ ok: false, code: "BACKEND_UNREACHABLE" }, { status: 502 });
  }
}
