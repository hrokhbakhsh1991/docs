import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPost } from "@/lib/api/bff-proxy";

export async function POST(req: Request): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  return proxyBffPost(req, "/api/v2/finance/payments/manual");
}
