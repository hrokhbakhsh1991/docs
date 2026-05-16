import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPatch } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tenantId: string; userId: string } };

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId, userId } = context.params;
  return proxyBffPatch(
    req,
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/capabilities`,
  );
}
