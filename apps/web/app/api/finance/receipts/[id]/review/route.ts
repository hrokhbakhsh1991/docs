import { proxyFinanceApiPatch } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly id: string }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { id } = await context.params;
  const body = await req.text();
  return proxyFinanceApiPatch(req, `/finance/receipts/${encodeURIComponent(id)}/review`, body);
}
