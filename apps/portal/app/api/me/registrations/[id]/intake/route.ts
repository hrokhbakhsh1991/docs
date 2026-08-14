import { NextResponse } from "next/server";
import { registerWorkspaceIntakeSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { getWorkspaceIntakePlugin, resolveIntakeSchema } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Member amend allowlisted intake (transport) while pending/waitlisted.
 * Upstream: PATCH `{registrationApiPath}/:id` when features.memberPendingIntakeAmend.
 */
export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  bindWorkspacePluginRegisterInvokers();
  await registerWorkspaceIntakeSafe(bootstrap.pluginId);
  const features = resolveIntakeSchema(bootstrap.pluginId).features;
  if (features.memberPendingIntakeAmend !== true) {
    return NextResponse.json({ ok: false, code: "NOT_SUPPORTED" }, { status: 501 });
  }

  const intake = getWorkspaceIntakePlugin(bootstrap.pluginId)?.catalogIntake;
  const apiPath = intake?.registrationApiPath?.trim() ?? "";
  if (apiPath.length === 0) {
    return NextResponse.json({ ok: false, code: "NOT_SUPPORTED" }, { status: 501 });
  }

  const { id } = await context.params;
  const registrationId = id.trim();
  if (registrationId.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));

  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}${apiPath}/${encodeURIComponent(registrationId)}`,
    {
      method: "PATCH",
      headers: {
        ...headers,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  const payload = (await res.json().catch(() => ({}))) as {
    code?: string;
    data?: { id?: string; status?: string };
  };
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
      { status: res.status }
    );
  }
  return NextResponse.json({ ok: true, data: payload.data ?? null }, { status: 200 });
}
