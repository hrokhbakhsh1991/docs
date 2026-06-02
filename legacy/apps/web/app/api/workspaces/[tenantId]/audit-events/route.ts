import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffGetWithSearch } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tenantId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId } = context.params;
  return proxyBffGetWithSearch(
    req,
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/audit-events`,
  );
}
