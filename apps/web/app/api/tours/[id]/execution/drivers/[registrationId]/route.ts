import { NextResponse } from "next/server";

import { operatorApiFetch } from "@/auth/operator-api-fetch";
import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { resolveTourOpsApiBaseUrl } from "@/platform/tour-ops-api-base";

type RouteContext = { readonly params: Promise<{ id: string; registrationId: string }> };

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id, registrationId } = await ctx.params;
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const body = await req.text();
  const incoming = new URL(req.url);
  const response = await operatorApiFetch(
    `${resolveTourOpsApiBaseUrl()}/tours/${encodeURIComponent(id)}/execution/drivers/${encodeURIComponent(registrationId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        host: incoming.host.split(":")[0] ?? "localhost",
        "Content-Type": "application/json",
      },
      body,
      cache: "no-store",
    }
  );
  return NextResponse.json(await response.json().catch(() => ({})), { status: response.status });
}
