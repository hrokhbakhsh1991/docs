import { proxyFinanceApiPost } from "@/finance/proxy-finance-api.server";

type RouteContext = { params: Promise<{ refundId: string }> };

export async function POST(req: Request, context: RouteContext) {
  const { refundId } = await context.params;
  const body = await req.text();
  return proxyFinanceApiPost(
    req,
    `/finance/refunds/${encodeURIComponent(refundId)}/reject`,
    body.length > 0 ? body : "{}"
  );
}
