import { proxyEngagementApiPost } from "@/engagement/proxy-engagement-api.server";

type RouteContext = {
  readonly params: Promise<{ userId: string }>;
};

export async function POST(req: Request, context: RouteContext) {
  const { userId } = await context.params;
  const body = await req.text();
  return proxyEngagementApiPost(
    req,
    `/engagement/operator/members/${encodeURIComponent(userId)}/adjust`,
    body,
  );
}
