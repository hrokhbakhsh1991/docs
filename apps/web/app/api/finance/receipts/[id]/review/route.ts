import { NextResponse } from "next/server";

import { proxyFinanceApiPatch } from "@/finance/proxy-finance-api.server";
import { parseFinanceReceiptReviewResponse } from "@/finance/finance-receipts-logic";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

/**
 * BFF contract: pass-through finance review result and guarantee
 * `bookingPaymentStatus` is present on successful approve payloads.
 */
export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.text();
  const proxied = await proxyFinanceApiPatch(
    req,
    `/finance/receipts/${encodeURIComponent(id)}/review`,
    body
  );
  const raw = (await proxied.json().catch(() => ({}))) as unknown;
  const parsed = parseFinanceReceiptReviewResponse(raw);
  if (parsed === null) {
    return NextResponse.json(raw, { status: proxied.status });
  }
  return NextResponse.json(parsed, { status: proxied.status });
}
