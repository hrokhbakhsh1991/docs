import { NextResponse } from "next/server";

import { requireBffSession } from "@/lib/api/bff-route-guard";
import { proxyBffPostMultipart } from "@/lib/api/bff-proxy";

type RouteContext = { params: { paymentId: string } };

export async function POST(
  req: Request,
  ctx: RouteContext,
): Promise<NextResponse> {
  const denied = requireBffSession();
  if (denied) {
    return denied;
  }
  const paymentId = ctx.params.paymentId?.trim();
  if (!paymentId) {
    return NextResponse.json(
      { error: { code: "INVALID_INPUT", message: "paymentId is required" } },
      { status: 400 },
    );
  }
  return proxyBffPostMultipart(
    req,
    `/api/v2/finance/payments/${encodeURIComponent(paymentId)}/receipt`,
  );
}
