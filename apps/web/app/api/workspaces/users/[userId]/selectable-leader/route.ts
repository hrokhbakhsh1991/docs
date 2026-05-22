import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPost } from "@/lib/api/bff-proxy";

type RouteContext = { params: { userId: string } };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { userId } = context.params;
  return proxyBffPost(req, `/api/v2/workspaces/users/${encodeURIComponent(userId)}/selectable-leader`);
}
