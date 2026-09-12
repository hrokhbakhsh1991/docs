import { proxyEngagementApiGet } from "@/engagement/proxy-engagement-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return proxyEngagementApiGet(req, "/engagement/operator/overview");
}
