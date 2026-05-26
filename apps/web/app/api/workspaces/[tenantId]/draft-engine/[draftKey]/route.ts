import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffDelete, proxyBffGet, proxyBffPatch } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tenantId: string; draftKey: string } };

function backendPath(tenantId: string, draftKey: string): string {
  return `/api/v2/workspaces/${encodeURIComponent(tenantId)}/draft-engine/${encodeURIComponent(draftKey)}`;
}

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId, draftKey } = context.params;
  return proxyBffGet(req, backendPath(tenantId, draftKey));
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId, draftKey } = context.params;
  return proxyBffPatch(req, backendPath(tenantId, draftKey));
}

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId, draftKey } = context.params;
  return proxyBffDelete(req, backendPath(tenantId, draftKey));
}
