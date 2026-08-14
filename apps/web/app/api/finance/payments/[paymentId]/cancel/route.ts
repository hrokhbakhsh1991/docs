import { proxyFinanceApiPost } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly paymentId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { paymentId } = await context.params;
  const body = await req.text();
  return proxyFinanceApiPost(req, `/finance/payments/${encodeURIComponent(paymentId)}/cancel`, body);
}
