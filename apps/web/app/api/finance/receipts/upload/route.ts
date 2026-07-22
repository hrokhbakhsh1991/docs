import { proxyFinanceReceiptUpload } from "@/finance/proxy-finance-receipt-upload.server";

export async function POST(req: Request) {
  return proxyFinanceReceiptUpload(req);
}
