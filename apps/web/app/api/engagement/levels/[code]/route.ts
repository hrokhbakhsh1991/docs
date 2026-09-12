import { proxyEngagementApiPatch } from "@/engagement/proxy-engagement-api.server";

type RouteContext = {
  readonly params: Promise<{ code: string }>;
};

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, context: RouteContext) {
  const { code } = await context.params;
  const body = await req.text();
  return proxyEngagementApiPatch(
    req,
    `/engagement/operator/levels/${encodeURIComponent(code)}`,
    body,
  );
}
