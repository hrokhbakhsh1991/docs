import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPost } from "@/lib/api/bff-proxy";

type RouteContext = { params: { receiptId: string } };

export async function POST(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const receiptId = ctx.params.receiptId?.trim();
  if (!receiptId) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "receiptId is required" } },
      { status: 400 },
    );
  }
  return proxyBffPost(
    req,
    `/api/v2/admin/finance/receipts/${encodeURIComponent(receiptId)}/approve`,
  );
}
