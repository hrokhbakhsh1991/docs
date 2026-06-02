import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffGet } from "@/lib/api/bff-proxy";

type RouteContext = { params: { userId: string } };

export async function GET(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { userId } = context.params;
  return proxyBffGet(req, `/api/v2/workspaces/users/${encodeURIComponent(userId)}/booking-summary`);
}
