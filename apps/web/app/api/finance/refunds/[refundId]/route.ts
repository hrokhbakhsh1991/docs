import { proxyFinanceApiGet } from "@/finance/proxy-finance-api.server";

type RouteContext = { params: Promise<{ refundId: string }> };

export async function GET(req: Request, context: RouteContext) {
  const { refundId } = await context.params;
  return proxyFinanceApiGet(req, `/finance/refunds/${encodeURIComponent(refundId)}`);
}
