import { NextResponse } from "next/server";
import { registerWorkspaceIntakeSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { getWorkspaceIntakePlugin } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import type { MemberRegistrationItem } from "@/me/fetch-member-registrations.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RouteContext = { params: Promise<{ id: string }> };

type UpstreamOwnedBody = {
  readonly code?: string;
  readonly data?: MemberRegistrationItem;
};

/**
 * Member-owned registration detail for SSR `/me/registrations/[id]`.
 * Upstream: GET `{registrationApiPath}/:id` from the workspace intake contract.
 */
export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await context.params;
  const registrationId = id.trim();
  if (registrationId.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  bindWorkspacePluginRegisterInvokers();
  await registerWorkspaceIntakeSafe(bootstrap.pluginId);
  const intake = getWorkspaceIntakePlugin(bootstrap.pluginId)?.catalogIntake;
  const apiPath = intake?.registrationApiPath?.trim() ?? "";
  if (apiPath.length === 0) {
    return NextResponse.json({ ok: false, code: "NOT_SUPPORTED" }, { status: 501 });
  }

  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}${apiPath}/${encodeURIComponent(registrationId)}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );
  const payload = (await res.json().catch(() => ({}))) as UpstreamOwnedBody;
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
      { status: res.status }
    );
  }
  const row = payload.data;
  if (row === undefined || typeof row.id !== "string") {
    return NextResponse.json({ ok: false, code: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: row }, { status: 200 });
}
