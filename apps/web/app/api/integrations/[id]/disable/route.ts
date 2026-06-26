import { proxyIntegrationsApiPost } from "@/integrations/proxy-integrations-api.server";

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await context.params;
  return proxyIntegrationsApiPost(req, `/integrations/${encodeURIComponent(id)}/disable`);
}
