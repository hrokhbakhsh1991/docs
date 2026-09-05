import { NextResponse } from "next/server";

import { readSessionTokenFromRequest } from "@/auth/read-session-token";
import { proxyTourExecutionRequest } from "@/features/tours/tour-execution-api-proxy";

type RouteContext = { readonly params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { id } = await ctx.params;
  const sessionToken = readSessionTokenFromRequest(req);
  if (sessionToken === null) {
    return NextResponse.json({ error: { code: "AUTH_UNAUTHENTICATED" } }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as unknown;
  const res = await proxyTourExecutionRequest({
    req,
    sessionToken,
    tourId: id,
    pathSuffix: "/tour-leader",
    method: "PATCH",
    body,
  });
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json(payload, { status: res.status });
}
