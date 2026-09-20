import { NextResponse } from "next/server";

import { resolveTourOpsApiBaseUrl } from "@/env";
import { buildMemberApiHeaders } from "@/me/build-member-api-headers.server";
import { resolvePortalIngressHost } from "@/tenant/resolve-portal-ingress-host";

type RouteContext = {
  readonly params: Promise<{ notificationId: string }>;
};

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const { notificationId } = await context.params;
  const host = resolvePortalIngressHost(req);
  const headers = await buildMemberApiHeaders(host);
  if (headers.Authorization === undefined) {
    return NextResponse.json({ ok: false, code: "AUTH_UNAUTHENTICATED" }, { status: 401 });
  }

  const res = await fetch(
    `${resolveTourOpsApiBaseUrl()}/member/notifications/${notificationId}/read`,
    {
      method: "PATCH",
      headers,
      cache: "no-store",
    },
  );
  const body = await res.json().catch(() => ({}));
  return NextResponse.json(body, { status: res.status });
}
