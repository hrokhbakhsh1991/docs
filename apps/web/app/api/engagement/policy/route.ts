import { proxyEngagementApiGet } from "@/engagement/proxy-engagement-api.server";

export async function GET(req: Request) {
  return proxyEngagementApiGet(req, "/engagement/operator/policy");
}
