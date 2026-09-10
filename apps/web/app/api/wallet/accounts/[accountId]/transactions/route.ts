import { proxyWalletApiGet } from "@/wallet/proxy-wallet-api.server";

type RouteContext = {
  readonly params: Promise<{ accountId: string }>;
};

export async function GET(req: Request, context: RouteContext) {
  const { accountId } = await context.params;
  const incoming = new URL(req.url);
  const query = incoming.searchParams.toString();
  const path =
    query.length > 0
      ? `/wallet/accounts/${encodeURIComponent(accountId)}/transactions?${query}`
      : `/wallet/accounts/${encodeURIComponent(accountId)}/transactions`;
  return proxyWalletApiGet(req, path);
}
