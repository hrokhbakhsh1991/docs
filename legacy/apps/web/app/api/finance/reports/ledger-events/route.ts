import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffGet } from "@/lib/api/bff-proxy";

export async function GET(req: Request): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  return proxyBffGet(req, "/api/v2/finance/reports/ledger-events");
}
