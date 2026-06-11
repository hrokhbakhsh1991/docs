import { NextResponse } from "next/server";

import { proxyWorkspaceDraftApiRequest } from "@/draft/proxy-workspace-draft-api.server";

type RouteContext = {
  readonly params: Promise<{
    readonly workspaceId: string;
    readonly namespace: string;
    readonly key: string;
  }>;
};

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { workspaceId, namespace, key } = await context.params;
  return proxyWorkspaceDraftApiRequest(req, {
    workspaceId,
    namespace,
    key,
    method: "GET",
  });
}

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const { workspaceId, namespace, key } = await context.params;
  const body = await req.text();
  return proxyWorkspaceDraftApiRequest(req, {
    workspaceId,
    namespace,
    key,
    method: "PATCH",
    body,
  });
}

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const { workspaceId, namespace, key } = await context.params;
  return proxyWorkspaceDraftApiRequest(req, {
    workspaceId,
    namespace,
    key,
    method: "DELETE",
  });
}
