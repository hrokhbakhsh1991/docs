import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffGetBlob } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tenantId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId } = context.params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();
  const path = qs
    ? `/api/v2/workspaces/${encodeURIComponent(tenantId)}/audit-events/export?${qs}`
    : `/api/v2/workspaces/${encodeURIComponent(tenantId)}/audit-events/export`;
  return proxyBffGetBlob(req, path);
}
