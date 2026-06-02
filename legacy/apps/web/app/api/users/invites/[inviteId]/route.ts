import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffDelete } from "@/lib/api/bff-proxy";

type RouteContext = { params: { inviteId: string } };

export async function DELETE(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { inviteId } = context.params;
  return proxyBffDelete(req, `/api/v2/users/invites/${encodeURIComponent(inviteId)}`);
}
