import { NextResponse } from "next/server";

import { proxyWorkspaceDraftListApiRequest } from "@/draft/proxy-workspace-draft-api.server";

type RouteContext = {
  readonly params: Promise<{
    readonly workspaceId: string;
  }>;
};

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { workspaceId } = await context.params;
  return proxyWorkspaceDraftListApiRequest(req, { workspaceId });
}
