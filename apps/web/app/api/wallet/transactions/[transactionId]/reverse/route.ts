import { proxyWalletApiPost } from "@/wallet/proxy-wallet-api.server";

type RouteContext = {
  readonly params: Promise<{ transactionId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { transactionId } = await context.params;
  const body = await req.text();
  return proxyWalletApiPost(
    req,
    `/wallet/transactions/${encodeURIComponent(transactionId)}/reverse`,
    body,
  );
}
