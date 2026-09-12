import { proxyEngagementApiPatch } from "@/engagement/proxy-engagement-api.server";

type RouteContext = {
  readonly params: Promise<{ ruleId: string }>;
};

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: RouteContext) {
  const { ruleId } = await context.params;
  const body = await req.text();
  return proxyEngagementApiPatch(
    req,
    `/engagement/operator/award-rules/${encodeURIComponent(ruleId)}`,
    body,
  );
}
