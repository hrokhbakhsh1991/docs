import { proxyEngagementApiGet } from "@/engagement/proxy-engagement-api.server";

type RouteContext = {
  readonly params: Promise<{ readonly userId: string }>;
};

export async function GET(req: Request, context: RouteContext): Promise<Response> {
  const { userId } = await context.params;
  return proxyEngagementApiGet(req, `/engagement/operator/members/${encodeURIComponent(userId)}`);
}
