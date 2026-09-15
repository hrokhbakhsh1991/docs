import { proxyWalletApiGet } from "@/wallet/proxy-wallet-api.server";

export async function GET(req: Request) {
  const incoming = new URL(req.url);
  const userId = incoming.searchParams.get("userId");
  if (userId === null || userId.trim().length === 0) {
    return Response.json(
      { error: { code: "VALIDATION_FAILED", message: "userId is required" } },
      { status: 400 }
    );
  }
  return proxyWalletApiGet(req, "/wallet/accounts");
}
