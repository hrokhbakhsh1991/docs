import { proxyWalletApiPost } from "@/wallet/proxy-wallet-api.server";

type RouteContext = {
  readonly params: Promise<{ accountId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { accountId } = await context.params;
  const body = await req.text();
  return proxyWalletApiPost(req, `/wallet/accounts/${encodeURIComponent(accountId)}/debit`, body);
}
