import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPost } from "@/lib/api/bff-proxy";

type RouteContext = { params: { tenantId: string; findingId: string; action: string } };

const ALLOWED = new Set(["acknowledge", "apply-ledger-adjustment"]);

export async function POST(req: Request, context: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const { tenantId, findingId, action } = context.params;
  if (!ALLOWED.has(action)) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Unknown reconciliation action" } },
      { status: 404 },
    );
  }
  return proxyBffPost(
    req,
    `/api/v2/workspaces/${encodeURIComponent(tenantId)}/reconciliation-findings/${encodeURIComponent(findingId)}/${action}`,
  );
}
