import { proxyFinanceApiPost } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly registrationId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { registrationId } = await context.params;
  const body = await req.text();
  return proxyFinanceApiPost(
    req,
    `/finance/payment-holds/${encodeURIComponent(registrationId)}/extend`,
    body
  );
}
