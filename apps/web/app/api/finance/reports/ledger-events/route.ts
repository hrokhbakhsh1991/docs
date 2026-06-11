import { proxyFinanceApiGet } from "@/finance/proxy-finance-api.server";

export async function GET(req: Request) {
  return proxyFinanceApiGet(req, "/finance/reports/ledger-events");
}
