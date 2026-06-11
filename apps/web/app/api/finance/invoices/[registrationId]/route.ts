import { proxyFinanceApiGet } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly registrationId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { registrationId } = await context.params;
  return proxyFinanceApiGet(req, `/finance/invoices/${encodeURIComponent(registrationId)}`);
}
