import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffDelete, proxyBffGet, proxyBffPatch } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tenantId: string } };

function backendPath(tenantId: string): string {
  return `/api/v2/workspaces/${encodeURIComponent(tenantId)}/tours/drafts`;
}

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  return proxyBffGet(req, backendPath(context.params.tenantId));
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  return proxyBffPatch(req, backendPath(context.params.tenantId));
}

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  return proxyBffDelete(req, backendPath(context.params.tenantId));
}
