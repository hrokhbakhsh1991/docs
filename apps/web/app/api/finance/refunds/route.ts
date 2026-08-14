import { proxyFinanceApiGet, proxyFinanceApiPost } from "@/finance/proxy-finance-api.server";

export async function GET(req: Request) {
  return proxyFinanceApiGet(req, "/finance/refunds");
}

export async function POST(req: Request) {
  const body = await req.text();
  return proxyFinanceApiPost(req, "/finance/refunds", body);
}
