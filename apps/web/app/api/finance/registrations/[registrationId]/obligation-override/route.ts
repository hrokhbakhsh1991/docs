import { proxyFinanceApiPut } from "@/finance/proxy-finance-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly registrationId: string }>;
};

export async function PUT(req: Request, context: RouteContext) {
  const body = await req.text();
  const { registrationId } = await context.params;
  return proxyFinanceApiPut(
    req,
    `/finance/registrations/${encodeURIComponent(registrationId)}/obligation-override`,
    body
  );
}
