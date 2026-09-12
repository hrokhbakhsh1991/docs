import { NextResponse } from "next/server";

import type { MemberTicketsBffError } from "@/me/tickets/member-tickets-bff.server";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalBootstrapForHost } from "@/tenant/resolve-portal-bootstrap";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

export type MemberTicketsRouteContext = {
  readonly host: string;
  readonly bootstrap: { readonly tenantId: string; readonly pluginId: string };
};

export function jsonTicketsError(
  code: string,
  status: number,
  message?: string,
): NextResponse {
  const body: MemberTicketsBffError = {
    ok: false,
    code,
    status,
    ...(message !== undefined ? { message } : {}),
  };
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function resolveMemberTicketsRouteContext(
  req: Request,
): Promise<MemberTicketsRouteContext | NextResponse> {
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return jsonTicketsError("AUTH_UNAUTHENTICATED", 401);
  }

  const bootstrap = await resolvePortalBootstrapForHost(host);
  if (headers["x-tenant-id"] !== bootstrap.tenantId) {
    return jsonTicketsError("AUTH_TENANT_HOST_MISMATCH", 403);
  }

  return { host, bootstrap };
}
