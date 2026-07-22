import { proxyFinanceApiPatch } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{
    readonly registrationId: string;
    readonly itemId: string;
  }>;
};

export async function PATCH(req: Request, context: RouteContext) {
  const { registrationId, itemId } = await context.params;
  const body = await req.text();
  return proxyFinanceApiPatch(
    req,
    `/finance/schedules/${encodeURIComponent(registrationId)}/items/${encodeURIComponent(itemId)}`,
    body
  );
}
