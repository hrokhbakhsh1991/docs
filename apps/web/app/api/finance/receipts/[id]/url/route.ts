import { NextResponse } from "next/server";

import { proxyFinanceApiGet } from "@/finance/proxy-finance-api.server";
import { isBrowserReachableReceiptUrl } from "@/finance/finance-receipts-logic";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

/** Operator receipt proof URL — rewrites signed MinIO URLs to same-origin file proxy. */
export async function GET(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const upstream = await proxyFinanceApiGet(
    req,
    `/finance/receipts/${encodeURIComponent(id)}/url`
  );
  if (!upstream.ok) {
    return upstream;
  }

  const payload = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  const sourceUrl = typeof payload.url === "string" ? payload.url : "";
  if (isBrowserReachableReceiptUrl(sourceUrl)) {
    return NextResponse.json(
      {
        ...payload,
        url: `/api/finance/receipts/${encodeURIComponent(id)}/file`,
      },
      { status: 200 }
    );
  }

  return NextResponse.json(payload, { status: upstream.status });
}
