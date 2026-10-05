import { proxyWalletApiGet } from "@/wallet/proxy-wallet-api.server";

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const userId = incoming.searchParams.get("userId");
  const search = incoming.searchParams.get("search");
  const hasUserId = userId !== null && userId.trim().length > 0;
  const hasSearch = search !== null && search.trim().length > 0;
  if (!hasUserId && !hasSearch) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_FAILED",
          message: "userId or search is required",
        },
      },
      { status: 400 }
    );
  }
  const query = incoming.searchParams.toString();
  const path = query.length > 0 ? `/wallet/accounts?${query}` : "/wallet/accounts";
  return proxyWalletApiGet(req, path);
}
