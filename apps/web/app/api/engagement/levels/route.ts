import {
  proxyEngagementApiGet,
  proxyEngagementApiPost,
} from "@/engagement/proxy-engagement-api.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return proxyEngagementApiGet(req, "/engagement/operator/levels");
}

export async function POST(req: Request) {
  const body = await req.text();
  return proxyEngagementApiPost(req, "/engagement/operator/levels", body);
}
