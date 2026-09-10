import { proxyWalletApiGet } from "@/wallet/proxy-wallet-api.server";

type RouteContext = {
  readonly params: Promise<{ accountId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { accountId } = await context.params;
  return proxyWalletApiGet(req, `/wallet/accounts/${encodeURIComponent(accountId)}/balance`);
}
