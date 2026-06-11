import { NextResponse } from "next/server";

import { proxyWorkspaceDraftEventsApiRequest } from "@/draft/proxy-workspace-draft-api.server";

type RouteContext = {
  readonly params: Promise<{
    readonly workspaceId: string;
    readonly namespace: string;
    readonly key: string;
  }>;
};

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const { workspaceId, namespace, key } = await context.params;
  return proxyWorkspaceDraftEventsApiRequest(req, { workspaceId, namespace, key });
}
