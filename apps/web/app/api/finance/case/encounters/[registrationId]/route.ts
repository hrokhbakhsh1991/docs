import { proxyFinanceApiGet } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly registrationId: string }>;
};

/**
 * BFF → GET /finance/case/encounters/:registrationId (PR12-A).
 * Proxies presentation DTO only; no CaseOutput on the wire to the client.
 */
export async function GET(req: Request, context: RouteContext) {
  const { registrationId } = await context.params;
  return proxyFinanceApiGet(
    req,
    `/finance/case/encounters/${encodeURIComponent(registrationId)}`
  );
}
