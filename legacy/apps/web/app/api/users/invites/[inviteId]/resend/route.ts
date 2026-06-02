import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPost } from "@/lib/api/bff-proxy";

type RouteContext = { params: { inviteId: string } };

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { inviteId } = context.params;
  return proxyBffPost(req, `/api/v2/users/invites/${encodeURIComponent(inviteId)}/resend`);
}
