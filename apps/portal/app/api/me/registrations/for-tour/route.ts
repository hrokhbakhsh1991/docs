import { NextResponse } from "next/server";
import { registerWorkspaceIntakeSafe } from "@app-tour/workspace-plugin-host/register-safe";
import { bindWorkspacePluginRegisterInvokers } from "@app-tour/guest-workspace-runtime/bind-register-invokers";
import { getWorkspaceIntakePlugin, resolveIntakeSchema } from "@app-tour/workspace-sdk";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

/**
 * Self-registration gate for catalog register page.
 * Upstream: GET `{registrationApiPath}/for-tour/:tourId` when intake features.selfRegistrationGate.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const host = resolvePortalIngressHost(req);
  const bootstrap = await resolvePortalBootstrapForHost(host);
  const headers = await buildMemberApiHeaders(host);

  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const url = new URL(req.url);
  const tourId = url.searchParams.get("tourId")?.trim() ?? "";
  if (tourId.length === 0) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYLOAD" }, { status: 400 });
  }

  bindWorkspacePluginRegisterInvokers();
  await registerWorkspaceIntakeSafe(bootstrap.pluginId);
  const features = resolveIntakeSchema(bootstrap.pluginId).features;
  if (features.selfRegistrationGate !== true) {
    return NextResponse.json({ ok: true, data: { self: null } }, { status: 200 });
  }

  const intake = getWorkspaceIntakePlugin(bootstrap.pluginId)?.catalogIntake;
  const apiPath = intake?.registrationApiPath?.trim() ?? "";
  if (apiPath.length === 0) {
    return NextResponse.json({ ok: true, data: { self: null } }, { status: 200 });
  }

  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}${apiPath}/for-tour/${encodeURIComponent(tourId)}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );
  const payload = (await res.json().catch(() => ({}))) as {
    code?: string;
    data?: { self?: { id: string; status: string } | null };
  };
  if (!res.ok) {
    return NextResponse.json(
      { ok: false, code: typeof payload.code === "string" ? payload.code : "unknown_error" },
      { status: res.status }
    );
  }
  return NextResponse.json(
    { ok: true, data: { self: payload.data?.self ?? null } },
    { status: 200 }
  );
}
