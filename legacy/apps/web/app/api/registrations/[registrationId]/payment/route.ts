import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPatch } from "@/lib/api/bff-proxy";

type RouteContext = { params: { registrationId: string } };

export async function PATCH(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { registrationId } = context.params;
  return proxyBffPatch(req, `/api/v2/registrations/${encodeURIComponent(registrationId)}/payment`);
}
