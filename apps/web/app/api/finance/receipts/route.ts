import { proxyFinanceApiPost } from "@/finance/proxy-finance-api.server";

export async function POST(req: Request) {
  const body = await req.text();
  return proxyFinanceApiPost(req, "/finance/receipts", body);
}
