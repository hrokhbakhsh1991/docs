import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPatch } from "@/lib/api/bff-proxy";

export async function PATCH(req: Request): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  return proxyBffPatch(req, "/api/v2/users/bulk-role");
}
